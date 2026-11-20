# Shikimori Explorer

Универсальный сайт: вводишь название любого аниме или манги, выбираешь результат и смотришь доступных персонажей, изображения, имена, роли и описания. При открытии персонажа сайт дополнительно ищет семейные связи в Anime Characters Database (ACDB) и строит кликабельное семейное дерево. Проект готов к деплою на Vercel.

## Деплой на Vercel

1. Распакуй ZIP.
2. Создай новый репозиторий на https://github.com/new.
3. Загрузи **содержимое папки** `shikimori-explorer` в корень репозитория (папки `api`, `lib`, `public` должны быть на верхнем уровне).
4. На https://vercel.com/new импортируй этот репозиторий.
5. Framework Preset: **Other**. Build Command оставь пустым. Output Directory оставь пустым. Install Command можно оставить пустым.
6. Нажми Deploy.

## API маршруты

- `GET /api/search?q=naruto` — поиск тайтлов.
- `GET /api/anime?id=1` — информация о тайтле.
- `GET /api/roles?id=1` — список ролей/персонажей.
- `GET /api/character?id=1` — подробности персонажа Shikimori.
- `GET /api/acdb-relations?name=Naruto%20Uzumaki&title=Naruto` — поиск персонажа и его семейных связей в ACDB.
- `GET /api/acdb-relations?id=7861` — загрузка связей по ID персонажа ACDB.

## Важные ограничения

Сайт использует публичный API Shikimori. Доступность данных зависит от самого Shikimori. API `/animes/{id}/roles` возвращает персонажей и их роли, а `/characters/{id}` — карточку персонажа. Публичный API не гарантирует структурированное генеалогическое дерево (мать, отец, дети, братья/сёстры), поэтому сайт не придумывает родственные связи. Если Shikimori не предоставляет такие связи отдельными данными, их можно проверить на странице персонажа/тайтла вручную.

Проект не связан официально с Shikimori. Уважай лимиты и правила использования сервиса.

## Семейное дерево персонажей

В профиле персонажа есть интерактивная схема: родители сверху, братья и сёстры слева, супруги/партнёры справа, дети и другие родственники ниже. Карточки кликабельны. Для персонажей, найденных только во внешней базе, открывается профиль ACDB и их собственная ветка.

Источники связей:
- Shikimori — текст описания и явные ссылки `[character=ID]`.
- Anime Characters Database (ACDB) — отдельная база с пользовательскими отношениями между персонажами; серверная функция ищет совпадение по имени и названию тайтла, затем читает отношения профиля.

ACDB — пользовательская база, а не официальный реестр канона: возможны ошибки, дубли, альтернативные версии персонажа и неполные связи. Поэтому возле дерева есть ссылки на источники. Не найденные связи не додумываются. Изображения внешних персонажей берутся из их карточек ACDB.

Wikidata может использоваться как дополнительный источник в будущем, но покрытие вымышленных персонажей там заметно менее полное; сейчас основной дополнительный источник — ACDB.


## Family Tree parser update

- ACDB relation extraction now supports relation anchors outside `<li>` rows and scans the full character profile as a last-resort fallback.
- The API response includes `diagnostics.relationRowsParsed`.
- The character profile reports whether ACDB matched the character, how many relationships were returned, or why the source failed.
- Relationship direction is preserved (for example, `Son of` means the linked character is a parent; `Mother of` means the linked character is a child).

Note: this update improves extraction when ACDB contains a relation; it cannot invent family information that a source does not publish. ACDB is community-maintained and should be checked against the linked profile.


## Franchise-wide character coverage

- Search now queries `/animes`, `/mangas` and `/ranobe` and labels each result by media type.
- The selected anime, manga or ranobe loads Shikimori `/related` entries, including related seasons, movies, OVAs, specials and manga/anime adaptations where Shikimori exposes them.
- Character lists are merged across the related entries, de-duplicated by Shikimori character ID, and show which entries contain each character.
- When a character profile opens, the app loads descriptions for other characters in the merged franchise roster (up to 80 profiles, four concurrent requests) so reciprocal family links can be found even if only the parent's description states the relationship.
- ACDB remains an optional source. HTTP 503 is an upstream ACDB availability error and does not prevent Shikimori-based family extraction.

The related-title endpoint is limited to relations Shikimori publishes. It does not infer that an unrelated OVA or filler episode belongs to a franchise if Shikimori has no relation entry.


## Family tree precision fix (V3)

- Kinship is now accepted only when a relation term is grammatically adjacent to a matched character name or explicit Shikimori character link. General words elsewhere in a biography cannot turn an unrelated character into a parent.
- ACDB relation labels are matched as whole words/phrases. The previous substring test could interpret the letters `mat` inside `information` as `mother`, producing false parents such as Masumi Shirase.
- Removed the unsafe last-resort scan of arbitrary links across the entire ACDB profile; only structured relation rows and relation-section fallback are used.
- Repeated character links in the "mentioned" section are deduplicated.


## V4: Wikidata + исправление парсера ACDB

- Новый маршрут `GET /api/wikidata-relations?name=Naruto%20Uzumaki&title=Naruto` — семейные связи из Wikidata (P22 отец, P25 мать, P40 ребёнок, P26 супруг, P3373 брат/сестра, P1038 родственник). Если Wikidata недоступна, маршрут отвечает 200 с `unavailable: true`.
- Профиль персонажа теперь объединяет Shikimori + ACDB + Wikidata. Дубли (одно имя и тот же тип связи) убираются. Карточка родственника, которого нет в Shikimori, из Wikidata открывает его страницу на Wikidata.
- Исправлен `familyKind` в `api/acdb-relations.js`: вместо `\\b` (буквальный слэш) используется `\b` (граница слова). Раньше метки «Mother of», «Son of» и т.п. отбрасывались.
- Покрытие вымышленных персонажей в Wikidata неполное: отсутствие связи не означает, что её нет.


## V5: навигация по родственникам, прогресс-бар, картинки

- Клик по родственнику переключает профиль на этого персонажа внутри сайта (раньше открывалась страница Wikidata). Если персонаж есть в Shikimori, открывается его полный профиль с деревом; если он только в Wikidata/ACDB — профиль из этого источника со своим деревом.
- Прогресс-бар загрузки: профиль показывается только после завершения всех шагов (профиль, описания франшизы, ACDB, Wikidata, поиск картинок).
- Картинки: для родственников из Wikidata/ACDB без фото сервер ищет персонажа в Shikimori (`GET /api/shiki-find?name=...`) и берёт оттуда картинку и профиль. Поиск идёт по точному совпадению имени (порядок слов не важен).
- Кнопка «← Назад» (история переходов по родственникам).
- Кэш ответов ACDB/Wikidata/поиска в рамках сессии — повторные переходы быстрее.
- Защита от «гонок»: если быстро кликнуть другого персонажа, результат предыдущего загрузчика не перезапишет экран.
- На карточках родственников значок источника (SH — Shikimori, ACDB, WD — Wikidata) и подсказка с основанием связи.
- `GET /api/wikidata-relations?id=Q123` — загрузка по ID Wikidata, ответ включает описание персонажа.
