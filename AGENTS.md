# AGENTS.md — Киржач Телеком (провайдер AnyBalance)

Этот репозиторий содержит провайдер для приложения **AnyBalance** — виджет/плагин, который получает баланс и другую информацию из личного кабинета интернет-провайдера **Киржач Телеком** (`https://lk.kirzhachtelecom.ru`).

Здесь собрано всё, что нужно знать, чтобы продолжать разработку провайдера без разбора всего с нуля.

---

## 1. Что такое AnyBalance и как устроены провайдеры

**AnyBalance** — Android-приложение, показывающее балансы/счётчики на экране (виджет). Само приложение ничего не запрашивает: данные добывают **провайдеры** — плагины на JavaScript, которые логинятся на сайт и парсят данные.

Официальный репозиторий с сотнями готовых провайдеров: `https://github.com/dukei/any-balance-providers`
(локально склонирован в папку выше: `../any-balance-providers`).

Документация (вики репозитория):
- Philosophy, AnyBalanceAPI, Manifest, Preferences, History, Icon, Debugging — в `../any-balance-providers/wiki/` (клонируется с `https://github.com/dukei/any-balance-providers.wiki.git`)

### Структура этой репы

```
ab-internet-kirzach-telecom/
├── AGENTS.md                # этот документ
├── test-harness.js          # стенд для тестирования провайдера (Node.js)
├── install-zip/             # готовый установочный архив
│   └── ab-internet-kirzach-telecom.zip
└── provider/                # исходники провайдера
    ├── anybalance-manifest.xml
    ├── preferences.xml
    ├── main.js
    ├── library.js
    ├── history.xml
    └── icon.png
```

### Провайдер — это набор файлов в папке `provider/`:

| Файл | Назначение |
|---|---|
| `anybalance-manifest.xml` | Манифест: id, версия, название, описание, автор, **счётчики**, тип, страна |
| `preferences.xml` | Пользовательские настройки (логин/пароль) |
| `main.js` | Логика: функция `main()` — вход, парсинг, `AnyBalance.setResult()` |
| `library.js` | Стандартная библиотека-модуль AnyBalance (помощники `AB.*`). Копия сборки из `../any-balance-providers/modules/library/build/head/library.min.js` |
| `history.xml` | История версий (обязательно увеличивать при каждом изменении) |
| `icon.png` | Иконка 128–256px, PNG, до 64 КБ |

**Установка в AnyBalance**: провайдер упаковывается в zip (файлы в корне архива, без вложенной папки) и ставится через «Установить провайдера из файла». Ид провайдера обязательно должен начинаться с `ab-`.

### Манифест (`anybalance-manifest.xml`)

```xml
<provider>
  <id version="3">ab-internet-kirzach-telecom</id>   <!-- version растёт при каждом изменении! -->
  <api flags="no_browser"/>
  <name>Киржач Телеком</name>
  <description html="true"><![CDATA[...]]></description>
  <author>K. Molchanov</author>
  <files>
    <icon>icon.png</icon>
    <preferences>preferences.xml</preferences>
    <js>library.js</js>   <!-- библиотека грузится первой -->
    <js>main.js</js>      <!-- файл с main() -->
    <history>history.xml</history>
  </files>
  <counters>
    <counter id="balance" name="Баланс" units=" р"/>   <!-- id = имя переменной в result -->
    <counter id="fio" name="ФИО" type="text"/>
    <counter id="last_pay_date" name="Дата последнего платежа" type="time" format="dd.MM.yyyy"/>
  </counters>
  <type>internet</type>
  <country>ru</country>
</provider>
```

- Типы счётчиков: `numeric` (по умолчанию), `text`, `time` (дата, мс с 1970), `time_interval` (секунды), `html`.
- `units`/`suffix` — суффикс (« р»). `prefix` — префикс.
- Счётчик `__tariff` (с двумя подчёркиваниями) — «магический»: показывает название тарифа в списке аккаунтов; в манифесте не декларируется, всегда заполняется.
- **ВАЖНО**: версию в `<id version>` и запись в `history.xml` надо увеличивать при КАЖДОМ изменении, иначе AnyBalance закеширует старую версию.

### Настройки (`preferences.xml`)

```xml
<PreferenceScreen>
  <EditTextPreference title="Логин" key="login" obligatory="true" summary="||{@s}" .../>
  <EditTextPreference title="Пароль" key="password" obligatory="true" inputType="textPassword" .../>
</PreferenceScreen>
```

Значения попадают в `AnyBalance.getPreferences()` под именами `key`.

---

## 2. AnyBalance API (главное из `main.js`)

| Функция | Назначение |
|---|---|
| `AnyBalance.getPreferences()` | Объект настроек (`prefs.login`, `prefs.password`) |
| `AnyBalance.requestGet(url, headers?)` | Синхронный GET, возвращает тело ответа (строку) |
| `AnyBalance.requestPost(url, data, headers?)` | Синхронный POST. `data` — объект → форма-urlencoded; редиректы следуются автоматически |
| `AnyBalance.getLastStatusCode()` | HTTP-код последнего ответа |
| `AnyBalance.setResult({success: true, ...счётчики})` | Передать результат. Вызывается ОДИН раз, в конце |
| `AnyBalance.isAvailable('c1','c2')` | Проверить, выбрал ли пользователь счётчик (оптимизация) |
| `AnyBalance.setDefaultCharset('utf-8')` | Кодировка ответов сервера |
| `AnyBalance.trace(msg)` | Лог для отладки (виден в «Показать последний лог» аккаунта) |
| `throw new AnyBalance.Error(msg, allowRetry, fatal)` | Ошибка. `fatal=true` — стоп обновлений (неверный пароль) |
| `AnyBalance.getLevel()`, `getCookies()`, `saveCookies()`, `getData/setData` | Прочее (см. вики AnyBalanceAPI) |

Все запросы — **синхронные** (в отличие от браузерного JS).

---

## 3. Библиотека `AB.*` (library.js)

Загружается первой, предоставляет помощники:

- `AB.getParam(html, result, 'counter_id', /regexp/, replaces, parser)` — достать значение по регэкспу и записать в счётчик (только если счётчик включён). Можно вызывать как `AB.getParam(html, /regexp/, replaces, parser)` без result — вернёт значение.
- `AB.checkEmpty(val, 'msg')` — бросить ошибку, если пусто.
- `AB.parseBalance(text)` — «900,00 р» → 900. `AB.parseDateISO`, `AB.parseDateWord`, `AB.parseDate`.
- `AB.replaceTagsAndSpaces` — массив замен (срезает HTML-теги, сущности, лишние пробелы).
- `AB.html_entity_decode(str)`, `AB.getJson(str)`, `AB.getJsonEval(str)` (выполняет JS-код и возвращает JSON), `AB.getJsonObject(html, re)`.
- `AB.getElement/ById/ByClassName`, `AB.getElements`, `AB.sumParam`, `AB.processTable`.
- `AB.addHeaders(obj)` — объединить с `g_headers`. `AB.joinUrl`. `AB.createFormParams(html, process)` — вытащить поля формы.
- `AB.setCountersToNull(result)`, `AB.regexEscape`, `AB.safeEval` и др.

Полный список возвращается в конце `library.js` (объект-список `AB`).

---

## 4. Как устроен именно наш провайдер (Hupo-платформа)

### Платформа

ЛК Киржач Телекома — это биллинг **Hupo** (Ruby on Rails). Та же платформа у провайдеров из репозитория:
`ab-internet-morton` (lk.mtel.ru), `ab-internet-aido`, `ab-internet-lofisnet`, `ab-internet-grin` — их `main.js` можно использовать как образец.

### Поток входа (main.js)

1. `GET https://lk.kirzhachtelecom.ru/login` — страница содержит CSRF-токен:
   `<input type="hidden" name="authenticity_token" value="...">`
2. `POST /login` с полями: `utf8=✓`, `authenticity_token`, `user[login]`, `user[password]`, `commit=Войти`
   (обязательно с куками сессии из GET — иначе ответ `error_msg_code=unverified_request`).
3. После успешного входа в HTML встроен JSON:
   `context.Application = new HupoApp({...}, {logLevel: "debug", locale: {...}});`
   Достаётся регэкспом `/new\sHupoApp\(([\s\S]*?),\s*\{logLevel/i` + `AB.getJsonEval`.

### Полезные поля JSON (`json.data`)

- `personal_accounts[0]` — лицевой счёт:
  - `n_sum_bal` — баланс (строка «0.0»)
  - `vc_account` / `vc_code` — номер лицевого счёта
  - `n_recommended_pay` — рекомендуемый платёж / **сумма задолженности** (когда услуга заблокирована)
  - `n_last_payment_sum`, `d_last_payment`, `vc_last_payment_type` — последний платёж
  - `d_accounting_begin` / `d_accounting_end` — расчётный период (часто `null`)
- `person.vc_name` — ФИО
- `servs[]` — услуги/тарифы:
  - `vc_name` — название тарифа (идёт в `__tariff`)
  - `n_good_sum` — стоимость в месяц
  - `n_good_state_id` — состояние услуги. **8114 = `GOOD_STATE_InsufficientFunds`** (блокировка за неуплату)

### Логика задолженности (важно!)

ЛК показывает баланс из `n_sum_bal`, но при блокировке за неуплату (`n_good_state_id == 8114`
у любой услуги) показывает **«Задолженность»** равную `n_recommended_pay`.
Провайдер в этом случае выдаёт `balance = -n_recommended_pay` (минус на сумму долга).
Когда долга нет — `balance = n_sum_bal`, а `recommended_pay` показывается отдельным счётчиком.

---

## 5. Как тестировать (test-harness.js)

В репе есть **`test-harness.js`** — стенд, эмулирующий AnyBalance API в Node.js
(синхронные HTTP-запросы через curl, куки в локальном файле, песочница vm).

Запуск (логин/пароль только через окружение, никуда не хардкодить!):

```bash
KT_LOGIN=<логин> KT_PASS=<пароль> node test-harness.js
```

Что делает: грузит `library.js` и `main.js` в vm-песочницу, вызывает `main()`,
печатает запросы, trace-сообщения и итоговый `result`.

### Грабли тестового стенда

1. **`/tmp` в Termux не работает** для cookie-файла — харнесс пишет куки в
   `ck_harness.txt` рядом с собой, а в конце прогона **удаляет его сам**.
   ВАЖНО: сервер кладёт в cookie логин пользователя, поэтому если файл остался
   (прерванный прогон) — удалить его вручную и НИКОГДА не коммитить.
2. **Нельзя передавать в vm-песочницу хост-объекты `String`/`Array`/`JSON`** —
   vm должен использовать собственные интринсики, иначе библиотека не расширит
   `String.prototype.htmlEntityDecode` для строк внутри vm. В песочницу передаются
   только `AnyBalance`, `console`, таймеры и алиасы `global/self/window`.
3. HTTP-запросы должны быть синхронными (в AnyBalance API нет промисов) — используется
   `curl` через `execFileSync` с массивом аргументов (без shell, чтобы не ломались
   спецсимволы).

---

## 6. Сборка архива

Архив — zip с 6 файлами провайдера **в корне** (без вложенной папки!).
Просто запустить из корня репы:

```bash
./build-zip.sh
```

Скрипт проверяет наличие всех 6 файлов, собирает
`install-zip/ab-internet-kirzach-telecom.zip` (через python3 zipfile — утилиты `zip`
в Termux нет) и печатает список файлов архива.

**НЕ включать в архив**: `AGENTS.md`, `test-harness.js`, `ck_harness.txt`, сам zip (архив собирается в `../install-zip/`, вне папки `provider/`).

---

## 7. Правила и грабли (чтобы не наступить снова)

1. **Версия**: каждый раз +1 в `<id version>` и запись в `history.xml`. Иначе кеш AnyBalance.
2. **Личные данные**: в репе НЕ должно быть логинов/паролей/ФИО/телефонов реальных
   пользователей. Только переменные `prefs.login`/`prefs.password`. Автор (K. Molchanov) — ок.
   Креды для тестов передаются через `KT_LOGIN`/`KT_PASS` при запуске харнесса.
3. **Куки обязательны**: токен `authenticity_token` привязан к сессии — GET логин-страницы
   и POST должны идти с одним cookie-джаром.
4. Токен в HTML может быть с `&quot;`-экранированием → применять `AB.html_entity_decode`.
5. Ошибки входа на сайте: `<div class='error_container'>...</div>` (кавычки бывают и
   одинарные, и двойные). «Неверный логин или пароль» → бросать с `fatal=true`.
6. `n_sum_bal` и суммы — строки; всегда `AB.parseBalance`/`parseFloat`.
7. Даты ISO с таймзоной (`2026-07-27T17:12:58.000+03:00`) парсит `AB.parseDateISO`.
8. Если в ЛК появится новый биллинг (сайт переедет) — искать `new HupoApp(` в HTML;
   если его нет — изучать новую структуру по аналогии с другими провайдерами из
   `../any-balance-providers/providers/`.
