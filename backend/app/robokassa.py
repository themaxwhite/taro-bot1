"""
Подписи и ссылки Робокассы.

Здесь только арифметика подписи и сборка ссылки — без обращений к базе и
к сети, чтобы это можно было проверить тестом целиком.

Две подписи считаются по разным паролям, и перепутать их легко:

* ссылка на оплату — MD5 от `MerchantLogin:OutSum:InvId:Пароль#1`;
* уведомление на ResultURL — MD5 от `OutSum:InvId:Пароль#2`.

Порядок полей строгий, и сравнение регистронезависимое: Робокасса
присылает подпись прописными буквами, а MD5 в Python выдаёт строчные.
"""

import hashlib
from urllib.parse import urlencode

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


def payment_signature(merchant_login: str, amount: str, invoice_id: int, password1: str) -> str:
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
    params = {
        "MerchantLogin": merchant_login,
        "OutSum": amount,
        "InvId": invoice_id,
        "Description": description,
        "SignatureValue": payment_signature(merchant_login, amount, invoice_id, password1),
        "Culture": "ru",
        "Encoding": "utf-8",
    }
    if receipt:
        # Чек уходит отдельным параметром и в подпись не входит.
        params["Receipt"] = receipt
    if is_test:
        params["IsTest"] = 1

    return f"{PAYMENT_URL}?{urlencode(params)}"


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
