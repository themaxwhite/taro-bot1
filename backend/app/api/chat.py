"""
Чат с тарологом: свободный разговор, оплачиваемый энергией.

Отличается от уточняющих вопросов к раскладу (api/ai.py) тем, что не
привязан к записи: сюда приходят с чем угодно, и таролог помнит
предыдущие реплики.

Три решения, из которых следует всё остальное:

1. Ответ генерируется до списания. Сначала проверяется, что энергии
   хватает, потом спрашивается модель, и только на удавшемся ответе
   снимается плата. Обратный порядок означал бы, что за отказ Groq
   человек платит пять единиц и не получает ничего.
2. Только Groq, без ухода на платный Anthropic (см.
   ai/client.py::generate_chat_reply). Чат — самое частое по числу
   вызовов место в приложении, и молчаливый переход на платный ключ
   выставил бы счёт, которого никто не заказывал.
3. Таролог видит последний расклад, знак зодиака и карту-покровителя.
   Без этого за пять энергии человек получает обычного чат-бота, а
   вопрос «что там с моим вчерашним раскладом» остаётся без ответа.
"""

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.client import generate_chat_reply
from app.api.deps import get_current_user
from app.api.subscriptions import available_unlocks, require_quota
from app.db import get_db
from app.energy import CHAT_QUESTION_COST
from app.models import ChatMessage, SpreadRecord, User
from app.moderation import ensure_question_allowed

router = APIRouter(prefix="/api/chat", tags=["chat"])

# Сколько прошлых реплик уходит в модель. Десять — это примерно пять
# обменов: хватает, чтобы разговор не начинался заново, и мало, чтобы не
# разогнать расход токенов на бесплатном тарифе Groq.
_HISTORY_FOR_CONTEXT = 10
# Сколько отдаётся на экран. Больше, чем уходит в модель: пролистать
# старое человеку полезно, даже если таролог этого уже не помнит.
_HISTORY_FOR_SCREEN = 100

_SYSTEM_PROMPT = (
    "Ты — таролог в мини-приложении «Tarot Aurum». Отвечаешь в чате, "
    "по-русски, тепло и по-человечески, 60-120 слов обычным текстом без "
    "заголовков и списков. Говори как живой человек, а не как справочник: "
    "без канцелярита, без оборотов вроде «важно отметить», без разбора "
    "значений карт по пунктам. Опирайся на карты, если они даны в "
    "контексте, и на то, что человек рассказывал раньше. Не предсказывай "
    "будущее как факт, не давай медицинских, юридических и финансовых "
    "советов, не ставь диагнозов. Если вопрос не про таро — ответь "
    "по-человечески и мягко верни разговор к картам. Заканчивай мысль "
    "законченным предложением."
)


class ChatMessageResponse(BaseModel):
    id: int
    role: str
    text: str


class ChatHistoryResponse(BaseModel):
    messages: list[ChatMessageResponse]
    # Цена приходит с сервера, а не зашита в экран: иначе цифра на кнопке
    # и реально списываемое разъедутся при первом же её изменении.
    cost: int
    balance: int


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)


class AskResponse(BaseModel):
    question: ChatMessageResponse
    answer: ChatMessageResponse
    balance: int


def _history(db: Session, user_id: int, limit: int) -> list[ChatMessage]:
    rows = (
        db.execute(
            select(ChatMessage)
            .where(ChatMessage.user_id == user_id)
            .order_by(ChatMessage.id.desc())
            .limit(limit)
        )
        .scalars()
        .all()
    )
    return list(reversed(rows))


def _last_spread_context(db: Session, user_id: int) -> str:
    """
    Последний расклад словами — чтобы на «что там с моим раскладом»
    таролог отвечал по существу.

    Берётся только разблокированный. Карты неоплаченного расклада не
    должны попадать в чат: иначе за вопрос можно прочитать то, что
    стоит отдельной разблокировки.
    """
    record = (
        db.execute(
            select(SpreadRecord)
            .where(SpreadRecord.user_id == user_id, SpreadRecord.unlocked.is_(True))
            .order_by(SpreadRecord.created_at.desc())
            .limit(1)
        )
        .scalars()
        .first()
    )
    if record is None:
        return ""

    try:
        cards = json.loads(record.cards_json)
    except (TypeError, ValueError):
        return ""

    lines = "; ".join(
        f"{card['position_label']}: {card['name']}"
        + (" (перевёрнутая)" if card.get("is_reversed") else "")
        for card in cards
    )
    context = f"Последний расклад пользователя — «{record.spread_title}»: {lines}."
    if record.question:
        context += f" Он спрашивал: «{record.question}»."
    return context


def _profile_context(user: User) -> str:
    parts = []
    if user.zodiac_sign:
        parts.append(f"знак зодиака: {user.zodiac_sign}")
    if user.patron_card:
        parts.append(f"карта-покровитель: {user.patron_card}")
    if user.interests:
        parts.append(f"обычно интересуется темами: {user.interests}")
    return ("О пользователе — " + ", ".join(parts) + ".") if parts else ""


@router.get("", response_model=ChatHistoryResponse)
def get_chat(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatHistoryResponse:
    return ChatHistoryResponse(
        messages=[
            ChatMessageResponse(id=m.id, role=m.role, text=m.text)
            for m in _history(db, user.telegram_id, _HISTORY_FOR_SCREEN)
        ],
        cost=CHAT_QUESTION_COST,
        balance=available_unlocks(db, user),
    )


@router.post("", response_model=AskResponse)
async def ask(
    body: AskRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AskResponse:
    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Вопрос пустой.")

    # Та же проверка, что и у вопросов к раскладу: иначе ограничения
    # обходились бы через чат.
    ensure_question_allowed(question)

    # Проверяем до вызова модели, а списываем после — см. решение 1 в
    # шапке модуля. Здесь возможна гонка: два одновременных вопроса
    # пройдут проверку и оба получат ответ, хотя энергии хватало на один.
    # Это осознанный размен: цена гонки — один неоплаченный ответ, цена
    # обратного порядка — плата за неполученный.
    if available_unlocks(db, user) < CHAT_QUESTION_COST:
        raise HTTPException(
            status_code=402,
            detail=f"Вопрос таролога стоит {CHAT_QUESTION_COST} энергии. Пополните баланс.",
        )

    context = " ".join(
        filter(None, [_profile_context(user), _last_spread_context(db, user.telegram_id)])
    )
    history: list[dict[str, str]] = [
        {"role": m.role, "content": m.text}
        for m in _history(db, user.telegram_id, _HISTORY_FOR_CONTEXT)
    ]
    if context:
        history.insert(0, {"role": "system", "content": context})
    history.append({"role": "user", "content": question})

    answer = await generate_chat_reply(_SYSTEM_PROMPT, history)
    if answer is None:
        # Ничего не списано: платить за неответ человек не должен.
        raise HTTPException(
            status_code=503,
            detail="Таролог сейчас не отвечает. Попробуйте через минуту — энергия не списана.",
        )

    require_quota(db, user, cost=CHAT_QUESTION_COST)

    question_row = ChatMessage(user_id=user.telegram_id, role="user", text=question)
    answer_row = ChatMessage(user_id=user.telegram_id, role="assistant", text=answer[:4000])
    db.add(question_row)
    db.add(answer_row)
    db.commit()
    db.refresh(question_row)
    db.refresh(answer_row)

    return AskResponse(
        question=ChatMessageResponse(id=question_row.id, role="user", text=question_row.text),
        answer=ChatMessageResponse(id=answer_row.id, role="assistant", text=answer_row.text),
        balance=available_unlocks(db, user),
    )
