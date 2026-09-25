"""Emergency special events (специвент) with voice messages.

Voice lines are pre-recorded files (``audio.src`` → frontend/public/audio); if a
file can't be played, the client falls back to speech synthesis of ``audio.text``.
"""

from app.seed.content.builders import BAD, BEST, CHIEF, OK, auto_end, c, choice, free_text, scene, voice

UNCONSCIOUS_TEXT = "Внимание! Вагон пять, место тридцать четыре. Пассажир потерял сознание и не реагирует. Что делать? Срочно!"

UNCONSCIOUS = {
    "slug": "emergency-unconscious",
    "title": "Пассажир без сознания",
    "description": "Экстренное голосовое от проводника 5-го вагона: пассажир потерял сознание.",
    "category": "medical",
    "position": "conductor",
    "kind": "emergency",
    "difficulty": 2,
    "cover": "🚨",
    "estimated_minutes": 2,
    "graph": {
        "start": "n1",
        "initial": {"loyalty": 70, "safety": 55},
        "alert": "Экстренное голосовое сообщение от проводника 5-го вагона",
        "alert_audio": voice(UNCONSCIOUS_TEXT, src="/audio/unconscious.m4a"),
        "characters": {
            "lena": {"name": "Лена", "role": "проводник 5-го вагона", "avatar": "👩‍🦰"},
            "chief": CHIEF,
        },
        "nodes": {
            "n1": choice(
                "lena",
                "(голосовое) Вагон 5, место 34 — пассажир потерял сознание и не реагирует! Что мне делать?",
                [
                    c("a", "Похлопать по щекам и дать понюхать нашатырь — должен очнуться", "n2", BAD, 0,
                      "Главное — проверить дыхание. Нашатырь не поможет при остановке сердца и может навредить.", safety=-20),
                    c("b", "Проверить дыхание. Дышит — устойчивое боковое положение, не дышит — начать СЛР и нести дефибриллятор. Я докладываю начальнику поезда и иду к тебе", "n2", BEST, 25,
                      "Верно: оценка дыхания, положение или СЛР, доклад и помощь коллеге.", safety=25),
                    c("c", "Ничего не делать, ждать, пока я подойду", "n2", OK, 5, "Потеряны драгоценные минуты: первую помощь нужно начинать сразу.", safety=-10),
                ],
                timer=15,
                audio=voice(UNCONSCIOUS_TEXT, src="/audio/unconscious.m4a"),
            ),
            "n2": free_text(
                "narrator",
                "Доложите начальнику поезда по служебной связи (напишите доклад).",
                "n3",
                rubric="Доклад по схеме: кто докладывает; где (вагон, место); что случилось; состояние пострадавшего (дышит или нет); "
                "что уже сделано; что требуется (поиск медика по громкой связи, скорая на ближайшей станции). Кратко и чётко.",
                ideal="Начальник поезда, докладывает проводник. Вагон 5, место 34: пассажир без сознания, дыхание есть, уложен "
                "в устойчивое боковое положение. Прошу объявить поиск медика и вызвать скорую к ближайшей станции.",
                keywords=["вагон", "мест", "сознани", "дыш", "скор"],
                max_points=25,
                safety=15,
                loyalty=0,
                timer=45,
            ),
            "n3": scene(
                "chief",
                "Принято. Объявляю поиск медика, скорая встретит поезд на ближайшей станции. Оставайтесь с пассажиром.",
                "end",
                audio=voice("Принято. Объявляю поиск медика, скорая встретит поезд на ближайшей станции. Оставайтесь с пассажиром.", src="/audio/chief-accepted.m4a"),
            ),
            "end": auto_end(
                ("Помощь оказана вовремя", "Пассажир пришёл в себя до прибытия скорой. Чёткий доклад сэкономил минуты."),
                ("Помощь оказана", "Пассажира передали медикам, но часть действий была несвоевременной."),
                ("Опасное промедление", "Первая помощь была оказана с ошибками. Пройдите курс первой помощи ещё раз."),
            ),
        },
    },
}

SMOKE_DETECTOR_TEXT = "Внимание, экипаж! Сработал датчик дыма в туалете третьего вагона. Проводнику третьего вагона — срочно проверить!"

SMOKE_DETECTOR = {
    "slug": "emergency-smoke-detector",
    "title": "Сработал датчик дыма",
    "description": "Автоматическое оповещение: датчик дыма в туалете вагона 3.",
    "category": "safety",
    "position": "conductor",
    "kind": "emergency",
    "difficulty": 1,
    "cover": "🚭",
    "estimated_minutes": 2,
    "graph": {
        "start": "n1",
        "initial": {"loyalty": 70, "safety": 60},
        "alert": "Сработал датчик дыма в туалете вагона 3",
        "alert_audio": voice(SMOKE_DETECTOR_TEXT, src="/audio/smoke-detector.m4a"),
        "characters": {"denis": {"name": "Денис", "role": "пассажир", "avatar": "🧑‍🦱"}, "chief": CHIEF},
        "nodes": {
            "n1": choice(
                "narrator",
                "(оповещение) Сработал датчик дыма в туалете вагона 3. Туалет занят.",
                [
                    c("a", "Сразу проверить: постучать, предупредить и открыть служебным ключом; при огне — огнетушитель и доклад", "n2", BEST, 25,
                      "Верно: вы ближе всех — проверка источника немедленно.", safety=20),
                    c("b", "Отключить датчик — наверняка кто-то курит", "n2", BAD, -5, "Отключать систему пожарной сигнализации запрещено.", safety=-25),
                    c("c", "Сообщить начальнику поезда и ждать указаний", "n2", OK, 10, "Доклад нужен, но проверить источник вы должны сразу.", safety=-5),
                ],
                timer=12,
                audio=voice(SMOKE_DETECTOR_TEXT, src="/audio/smoke-detector.m4a"),
            ),
            "n2": scene("denis", "(выходит из туалета) Да я только одну сигарету… Что такого?", "n3"),
            "n3": choice(
                "narrator",
                "Пассажир курил в туалете. Ваши действия?",
                [
                    c("a", "Накричать и пригрозить высадить на ходу", "end", BAD, 0, "Угрозы и крик — непрофессионально и эскалируют конфликт.", loyalty=-15),
                    c("b", "Отпустить с устным замечанием", "end", OK, 8, "Нарушение должно быть зафиксировано — курение в поезде создаёт риск пожара.", safety=-5),
                    c("c", "Спокойно объяснить, что курение в поезде запрещено и опасно, и сообщить начальнику поезда для оформления нарушения", "end", BEST, 20,
                      "Верно: спокойно, по регламенту, с фиксацией нарушения.", safety=10, loyalty=5),
                ],
                timer=20,
            ),
            "end": auto_end(
                ("Сработали как часы", "Источник найден за 40 секунд, нарушение оформлено, пассажиры спокойны."),
                ("Проверка проведена", "Источник найден, но реакция экипажа могла быть точнее."),
                ("Опасная реакция", "Отключённая сигнализация или промедление при задымлении — прямая угроза жизни пассажиров."),
            ),
        },
    },
}

ENGLISH_TEXT = (
    "Hello, sir! Please help! My daughter ate something with nuts, she has a very strong allergy. "
    "Her face is swelling and she cannot breathe well! We are in coach number seven!"
)

ENGLISH_ALLERGY = {
    "slug": "emergency-english-allergy",
    "title": "Hard: голосовое на английском",
    "description": "Иностранный пассажир присылает голосовое на английском: у дочери тяжёлая аллергическая реакция.",
    "category": "medical",
    "position": "conductor",
    "kind": "emergency",
    "difficulty": 3,
    "cover": "🌍",
    "estimated_minutes": 3,
    "graph": {
        "start": "n1",
        "lang": "en",
        "tags": ["english"],
        "initial": {"loyalty": 65, "safety": 50},
        "alert": "Голосовое сообщение на английском от иностранного пассажира",
        "alert_audio": voice(ENGLISH_TEXT, "en-IN", src="/audio/english-allergy.m4a"),
        "characters": {"raj": {"name": "Mr. Raj Sharma", "role": "passenger, coach 7", "avatar": "👳‍♂️"}, "chief": CHIEF},
        "nodes": {
            "n1": choice(
                "raj",
                "Hello, sir! Please help! My daughter ate something with nuts, she has a very strong allergy. Her face is swelling "
                "and she cannot breathe well! We are in coach number seven!",
                [
                    c("a", "Ответить, что не понимаете по-английски, и пойти искать кого-нибудь", "n2", BAD, 0,
                      "Языковой барьер — не повод терять время. Ключевые слова: allergy, can't breathe, coach seven — бегите в 7-й вагон.", safety=-20),
                    c("b", "Дать ребёнку воды и антигистаминное из аптечки", "n2", OK, 5,
                      "При отёке и затруднённом дыхании (анафилаксия) нужен адреналин — автоинжектор. Антигистаминные действуют слишком медленно.", safety=-10),
                    c("c", "Бежать в 7-й вагон, спросить про автоинжектор адреналина (EpiPen), объявить поиск медика и доложить начальнику поезда", "n2", BEST, 25,
                      "Верно: при анафилаксии счёт идёт на минуты, у аллергиков часто есть свой автоинжектор.", safety=25),
                ],
                timer=20,
                audio=voice(ENGLISH_TEXT, "en-IN", src="/audio/english-allergy.m4a"),
            ),
            "n2": free_text(
                "raj",
                "Mr. Sharma is panicking. Calm him down and ask the key question. Answer in English.",
                "n3",
                rubric="The answer must be in English; calm and reassuring; ask whether they have an epinephrine auto-injector (EpiPen); "
                "say that help / a doctor is coming; short simple sentences.",
                ideal="Please stay calm, I am here to help. Do you have an EpiPen? A doctor is on the way.",
                keywords=["epipen", "calm", "doctor", "help", "injector"],
                max_points=30,
                safety=15,
                loyalty=10,
                lang="en",
                placeholder="Please stay calm…",
            ),
            "n3": scene(
                "raj",
                "Yes, yes, we have the EpiPen! Thank you so much, sir!",
                "n4",
                audio=voice("Yes, yes, we have the EpiPen! Thank you so much, sir!", "en-IN", src="/audio/english-epipen.m4a"),
            ),
            "n4": choice(
                "narrator",
                "Автоинжектор применён, отёк спадает. Что дальше?",
                [
                    c("a", "Раз стало лучше — вернуться к работе", "end", BAD, 0,
                      "Реакция может вернуться через 1–2 часа (двухфазная анафилаксия). После адреналина нужна скорая.", safety=-20),
                    c("b", "Остаться рядом, следить за дыханием и передать начальнику поезда вызов скорой на ближайшую станцию", "end", BEST, 20,
                      "Верно: после адреналина обязательна медицинская помощь.", safety=15),
                ],
                timer=15,
            ),
            "end": auto_end(
                ("Language no barrier", "Девочку передали врачам на ближайшей станции. Мистер Шарма оставил благодарность на английском 🇬🇧"),
                ("Помощь оказана", "Девочке помогли, но часть времени была потеряна."),
                ("Языковой барьер победил", "Помощь пришла слишком поздно. Потренируйте ключевые фразы на английском."),
            ),
        },
    },
}

LOST_CHILD_TEXT = "Проводник! Мой сын пропал! Ему шесть лет, он в синей куртке! Мы стоим всего две минуты, помогите!"

LOST_CHILD = {
    "slug": "emergency-lost-child",
    "title": "Потерялся ребёнок",
    "description": "Стоянка две минуты, мама в панике: пропал шестилетний сын.",
    "category": "safety",
    "position": "conductor",
    "kind": "emergency",
    "difficulty": 2,
    "cover": "🧒",
    "estimated_minutes": 2,
    "graph": {
        "start": "n1",
        "initial": {"loyalty": 60, "safety": 55},
        "alert": "Экстренное голосовое от пассажирки вашего вагона",
        "alert_audio": voice(LOST_CHILD_TEXT, src="/audio/lost-child.m4a"),
        "characters": {"mom": {"name": "Анна", "role": "мама пассажира", "avatar": "👩"}},
        "nodes": {
            "n1": choice(
                "mom",
                "(голосовое) Проводник! Мой сын пропал! Ему шесть лет, он в синей куртке! Мы стоим всего две минуты!",
                [
                    c("a", "Сразу сообщить начальнику поезда (он решит вопрос с задержкой отправления), узнать приметы, проверить туалеты и тамбуры", "n2", BEST, 25,
                      "Верно: доклад и поиск внутри поезда, решение об отправлении — за начальником поезда и машинистом.", safety=20),
                    c("b", "Выбежать искать мальчика на перрон", "n2", BAD, 0,
                      "Вы оставили вагон перед отправлением. Поиск на перроне — задача дежурного по станции и полиции по запросу начальника поезда.", safety=-15),
                    c("c", "Сказать маме поискать самой по вагонам", "n2", BAD, 0, "Проводник отвечает за пассажиров — в том числе за детей.", loyalty=-20, safety=-10),
                ],
                timer=15,
                audio=voice(LOST_CHILD_TEXT, src="/audio/lost-child.m4a"),
            ),
            "n2": scene("narrator", "Через минуту мальчика нашли в вагоне-бистро: пошёл за мороженым.", "n3"),
            "n3": free_text(
                "mom",
                "Мама плачет от облегчения и ругает сына. Что вы скажете семье?",
                "end",
                rubric="Успокоить маму мягко, без упрёков; совет: договориться, что ребёнок не уходит один; ребёнок должен знать "
                "номер вагона и место; при необходимости сразу обращаться к проводнику.",
                ideal="Анна, всё хорошо, он нашёлся — вы молодец, что сразу сказали. Давайте договоримся: без мамы никуда. "
                "И запомни, пожалуйста, — вагон 3, место 15. Если что — сразу ко мне, я рядом.",
                keywords=["хорошо", "вагон", "мест", "один", "обращ"],
                max_points=20,
                loyalty=15,
                safety=5,
                timer=45,
            ),
            "end": auto_end(
                ("Нашли за минуту", "Поезд отправился по графику, семья благодарит экипаж."),
                ("Нашли", "Мальчик нашёлся, но действия были не самыми эффективными."),
                ("Рискованные действия", "Вагон остался без присмотра, поиск был хаотичным."),
            ),
        },
    },
}

EMERGENCY_SCENARIOS = [UNCONSCIOUS, SMOKE_DETECTOR, ENGLISH_ALLERGY, LOST_CHILD]
