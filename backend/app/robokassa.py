"""
Подписи и ссылки Робокассы.

Здесь только арифметика подписи и сборка ссылки — без обращений к базе и
к сети, чтобы это можно было проверить тестом целиком.

Две подписи считаются по разным паролям, и перепутать их легко:

* ссылка на оплату — MD5 от `MerchantLogin:OutSum:InvId:Пароль#1`,
  а при передаче состава чека — `MerchantLogin:OutSum:InvId:Receipt:Пароль#1`;
* уведомление на ResultURL — MD5 от `OutSum:InvId:Пароль#2`.

Порядок полей строгий, и сравнение регистронезависимое: Робокасса
присылает подпись прописными буквами, а MD5 в Python выдаёт строчные.
"""

import hashlib
import json
from urllib.parse import quote, urlencode

PAYMENT_URL = "https://auth.robokassa.ru/Merchant/Index.aspx"


def _md5(value: str) -> str:
    return hashlib.md5(value.encode()).hexdigest()


def format_amount(amount_rub: int) -> str:
    """
    Сумма в том виде, в каком уходит и в ссылку, и в подпись.

    Строка обязана быть одна и та же в обоих местах: подпись считается по
    символам, а не по числу, и «199» с «199.00» дадут разные хеши.
    """
    return f"{amount_rub:.2f}"


def build_receipt(*, title: str, amount_rub: int) -> str:
    """
    Состав чека — одна позиция на весь платёж.

    Без этого параметра чек не выбивается вовсе: Робокассе нечего
    фискализировать, она знает только сумму. Именно поэтому первые платежи
    прошли, а в «Моём налоге» ничего не появилось.

    Поля выбраны под самозанятого, оказывающего услуги:

    * ``payment_object: service`` — продаём услугу, а не товар;
    * ``payment_method: full_payment`` — полный расчёт сразу, без предоплат
      и рассрочек;
    * ``tax: none`` — плательщик налога на профессиональный доход НДС не
      платит, и «none» здесь означает именно это, а не нулевую ставку;
    * ``sno`` не указываем: система налогообложения к НПД неприменима, а
      лишнее поле Робокасса может не принять.

    Сумма позиции обязана совпадать с суммой платежа — иначе чек не сойдётся
    с оплатой.
    """
    receipt = {
        "items": [
            {
                "name": title[:128],
                "quantity": 1,
                "sum": amount_rub,
                "payment_method": "full_payment",
                "payment_object": "service",
                "tax": "none",
            }
        ]
    }
    # ensure_ascii=False: названия по-русски, и Робокасса ждёт UTF-8, а не
    # экранированные последовательности. separators без пробелов — строка
    # уходит и в подпись, и в адрес, и любой лишний символ меняет хеш.
    return json.dumps(receipt, ensure_ascii=False, separators=(",", ":"))


def _encode_receipt(receipt_json: str) -> str:
    """
    Кодирует чек для адреса — но не для подписи.

    Здесь расхождение между документацией и поведением, и оно стоило
    отдельной проверки. Документация говорит: «перед добавлением в строку
    для подписи значение Receipt нужно URL-кодировать». На деле Робокасса
    так подписанную ссылку отвергает с кодом 29 — неверная контрольная
    сумма.

    Проверено перебором прямо на её форме, четырьмя вариантами:

        без чека вовсе                                  — принято
        подпись по закодированному, в адресе тот же      — ошибка 29
        подпись по сырому JSON, в адресе закодированный  — ПРИНЯТО
        подпись по закодированному, в адресе сырой       — ошибка 29

    Поэтому подписываем сырой JSON, а в адрес кладём закодированный.
    """
    return quote(receipt_json, safe="")


def payment_signature(
    merchant_login: str,
    amount: str,
    invoice_id: int,
    password1: str,
    receipt: str | None = None,
) -> str:
    if receipt:
        # Сырой JSON, не закодированный — см. рассуждение в _encode_receipt.
        return _md5(f"{merchant_login}:{amount}:{invoice_id}:{receipt}:{password1}")
    return _md5(f"{merchant_login}:{amount}:{invoice_id}:{password1}")


def payment_url(
    *,
    merchant_login: str,
    password1: str,
    amount_rub: int,
    invoice_id: int,
    description: str,
    is_test: bool = False,
    receipt: str | None = None,
) -> str:
    """
    Ссылка, по которой человек уходит платить.

    Пользовательских параметров (`Shp_*`) здесь нет намеренно. Они попадают
    в обе подписи и в обе стороны обмена, то есть удваивают число мест, где
    можно ошибиться, а нужны были бы только чтобы узнать плательщика — но
    его и так однозначно даёт номер счёта, по которому лежит наша строка в
    базе.
    """
    amount = format_amount(amount_rub)
    receipt_encoded = _encode_receipt(receipt) if receipt else None

    params = {
        "MerchantLogin": merchant_login,
        "OutSum": amount,
        "InvId": invoice_id,
        "Description": description,
        "SignatureValue": payment_signature(
            merchant_login, amount, invoice_id, password1, receipt
        ),
        "Culture": "ru",
        "Encoding": "utf-8",
    }
    if is_test:
        params["IsTest"] = 1

    query = urlencode(params)
    if receipt_encoded:
        # Подставляем уже закодированную строку сами: пропусти её через
        # urlencode — и она закодируется второй раз, а подпись считалась по
        # однократной.
        query += "&Receipt=" + receipt_encoded

    return f"{PAYMENT_URL}?{query}"


def result_signature_valid(
    *, amount: str, invoice_id: str, password2: str, received: str
) -> bool:
    """
    Проверка подписи уведомления об оплате.

    Сумму берём ровно ту строку, что прислала Робокасса, и не приводим её
    к числу: подпись считается по символам, а «199.00» и «199.000000» —
    разные строки при одинаковом числе.
    """
    expected = _md5(f"{amount}:{invoice_id}:{password2}")
    return expected.lower() == (received or "").strip().lower()


def result_ok(invoice_id: int | str) -> str:
    """
    Ответ, которого Робокасса ждёт от ResultURL.

    Пока она не увидит ровно эту строку, уведомление считается
    недоставленным и повторяется — поэтому отвечать так нужно и в том
    случае, когда платёж у нас уже зачтён.
    """
    return f"OK{invoice_id}"
