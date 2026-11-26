# API · Chat: envío de mensajes

Todo lo que envía contenido: texto, medios, ubicación, contactos, botones, listas, carruseles, encuestas, edición y mensajes crudos.

Convenciones generales (autenticación, respuestas, destinatarios): [../api-guia-ia.md](../api-guia-ia.md). Este archivo se generó desde `static/api/spec.yml`.

### POST `/chat/send/audio`

**Sends an audio message**

Sends an audio message (must be base64 encoded in opus format, mime type audio/ogg)

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Audio` | string | **sí** | ej. `data:audio/ogg;base64,iVBORw0a` |
| `ContextInfo` | object | no | Optional context info for replies |
| `ContextInfo.IsForwarded` | boolean | no | Set to true to mark the message as forwarded. This is the preferred method for forwarding messages. |
| `ContextInfo.MentionedJID` | array<string> | no | Array of JIDs to mention in the message. Use full WhatsApp JID format (number@s.whatsapp.net). |
| `ContextInfo.Participant` | string | no | JID of original message sender |
| `ContextInfo.StanzaId` | string | no | Message ID to reply to |
| `Id` | string | no | ej. `ABCDABCD1234` |
| `MimeType` | string | no | ej. `audio/ogg; codecs=opus` |
| `PTT` | boolean | no | ej. `true` |
| `Phone` | string | **sí** | Destination phone digits (optional leading +) or full WhatsApp JID, including @lid; use @g.us for groups where supported. Bare numeric IDs use cached PN/LID mappings with a phone-number fallback. Usernames and BSUIDs are not supported. See the message destination rules above. |
| `QuotedMessage` | object | no | Optional quoted message payload for custom reply preview using extendedTextMessage. |
| `QuotedMessage.extendedTextMessage` | object | no |  |
| `QuotedMessage.extendedTextMessage.text` | string | no | ej. `Original message text` |
| `Seconds` | integer | no | ej. `15` |
| `Waveform` | array<integer> | no | ej. `[0 0 0 12 20 20 22 10 5 0 0 0]` |

### POST `/chat/send/buttons`

**Sends a Buttons message**

Sends a Buttons message

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Body` | string | **sí** | ej. `How you doin` |
| `Buttons` | array<object> | **sí** |  |
| `Buttons[].copy_code` | string | no | ej. `PROMO2024` |
| `Buttons[].id` | string | no | ej. `btn_confirm` |
| `Buttons[].phone_number` | string | no | ej. `+5511999999999` |
| `Buttons[].title` | string | no | ej. `Confirm` |
| `Buttons[].type` | string | no | ej. `reply` |
| `Buttons[].url` | string | no | ej. `https://example.com` |
| `ContextInfo` | object | no |  |
| `ContextInfo.Participant` | string | **sí** | ej. `5491155553935@s.whatsapp.net` |
| `ContextInfo.StanzaID` | string | **sí** | ej. `3EB06F9067F80BAB89FF` |
| `Footer` | string | no | ej. `Choose an option` |
| `Id` | string | no | ej. `ABCDABCD1234` |
| `Image` | string | no | ej. `https://example.com/image.jpg` |
| `Phone` | string | **sí** | Destination phone digits (optional leading +) or full WhatsApp JID, including @lid; use @g.us for groups where supported. Bare numeric IDs use cached PN/LID mappings with a phone-number fallback. Usernames and BSUIDs are not supported. See the message destination rules above. |
| `Title` | string | no | ej. `Main menu` |

### POST `/chat/send/carousel`

**Sends an image carousel**

Sends 2-10 ordered JPEG/PNG cards as one native interactive message to a direct PN/LID chat. All cards are validated before upload. Total image bytes are limited to 16 MiB and the JSON request to 24 MiB. Preparation has a 45-second budget and dispatch a detached 60-second budget; internal send-lock queueing can exceed the HTTP deadline. Acknowledgement does not prove rendering. The pinned whatsmeow version loses interactive AdditionalNodes on recipient retry receipts, so recovery is unverified. Never automatically resend after an ambiguous dispatch error or timeout. Replace sample image URLs with your own. See API.md for complete limits. Stdio method is chat.send.carousel; its existing 512-KiB line limit favors image URLs.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Body` | string | **sí** | ej. `Choose a destination` |
| `Cards` | array<object> | **sí** |  |
| `Cards[].Body` | string | **sí** | ej. `Summit` |
| `Cards[].Buttons` | array<object> | **sí** |  |
| `Cards[].Buttons[].id` | string | no | Required for reply, without controls, unique across all cards. Omit for other actions. |
| `Cards[].Buttons[].phone_number` | string | no | Required for cta_call; optional leading + and 6-15 digits. Omit for other actions. |
| `Cards[].Buttons[].title` | string | **sí** |  |
| `Cards[].Buttons[].type` | string (, reply, cta_url, cta_call) | no | Omitted or empty type means reply. |
| `Cards[].Buttons[].url` | string | no | Required for cta_url; absolute HTTP(S), no credentials, whitespace or controls. Omit for other actions. |
| `Cards[].Image` | string | **sí** | JPEG/PNG data URL or HTTP(S) URL. Images total at most 16 MiB, 4096px per side and 16 megapixels each. |
| `Id` | string | no | Optional printable ASCII without whitespace. Generated when omitted. Correlation only; reuse is not idempotency and does not replace history. |
| `Phone` | string | **sí** | Bare phone number or direct PN/LID JID; no groups, bots or device-specific JIDs |

### POST `/chat/send/contact`

**Sends a contact message**

Sends a contact message in VCARD format

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `ContextInfo` | object | no | Optional context info for replies |
| `ContextInfo.IsForwarded` | boolean | no | Set to true to mark the message as forwarded. This is the preferred method for forwarding messages. |
| `ContextInfo.MentionedJID` | array<string> | no | Array of JIDs to mention in the message. Use full WhatsApp JID format (number@s.whatsapp.net). |
| `ContextInfo.Participant` | string | no | JID of original message sender |
| `ContextInfo.StanzaId` | string | no | Message ID to reply to |
| `Id` | string | no | ej. `ABCDABCD1234` |
| `Name` | string | **sí** | ej. `John` |
| `Phone` | string | **sí** | Destination phone digits (optional leading +) or full WhatsApp JID, including @lid; use @g.us for groups where supported. Bare numeric IDs use cached PN/LID mappings with a phone-number fallback. Usernames and BSUIDs are not supported. See the message destination rules above. |
| `QuotedMessage` | object | no | Optional quoted message payload for custom reply preview using extendedTextMessage. |
| `QuotedMessage.extendedTextMessage` | object | no |  |
| `QuotedMessage.extendedTextMessage.text` | string | no | ej. `Original message text` |
| `Vcard` | string | **sí** | ej. `BEGIN:VCARD VERSION:3.0 N:Doe;John;;; FN:John Doe ORG:Example.com Inc.; TITLE:Imaginary test person EMAIL;type=INTERNET;type=WORK;type=pref:johnDoe@example.org TEL;type=WORK;type=pref:+1 617 555 1212 TEL;type=WORK:+1 (617) 555-1234 TEL;type=CELL:+1 781 555 1212 TEL;type=HOME:+1 202 555 1212 item1.ADR;type=WORK:;;2 Enterprise Avenue;Worktown;NY;01111;USA item1.X-ABADR:us item2.ADR;type=HOME;type=pref:;;3 Acacia Avenue;Hoitem2.X-ABADR:us END:VCARD` |

### POST `/chat/send/document`

**Sends a document message**

Sends any document (must be base64 encoded using application/octet-stream mime) MentionAll=true or a standalone @everyone mentions all group members; visible text is preserved. Explicit ContextInfo.MentionedJID supports ghost mentions.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `ContextInfo` | object | no | Optional context info for replies |
| `ContextInfo.IsForwarded` | boolean | no | Set to true to mark the message as forwarded. This is the preferred method for forwarding messages. |
| `ContextInfo.MentionedJID` | array<string> | no | Array of JIDs to mention in the message. Use full WhatsApp JID format (number@s.whatsapp.net). |
| `ContextInfo.Participant` | string | no | JID of original message sender |
| `ContextInfo.StanzaId` | string | no | Message ID to reply to |
| `Document` | string | **sí** | ej. `data:application/octet-stream;base64,aG9sYSBxdWUKdGFsCmNvbW8KZXN0YXMK` |
| `FileName` | string | **sí** | ej. `file.txt` |
| `Id` | string | no | ej. `ABCDABCD1234` |
| `MentionAll` | boolean | no | Mention all current group participants without visible phone numbers. A standalone @everyone also enables this; text is preserved. Direct chats are rejected and participant lookup failures abort sending. |
| `MimeType` | string | no | Explicit document MIME override. If omitted, uses the declared data URL or HTTP type, then the filename extension, then content detection. Missing, invalid, and generic octet-stream source types fall back; an implicit data URL text/plain default is not a declaration. |
| `Phone` | string | **sí** | Destination phone digits (optional leading +) or full WhatsApp JID, including @lid; use @g.us for groups where supported. Bare numeric IDs use cached PN/LID mappings with a phone-number fallback. Usernames and BSUIDs are not supported. See the message destination rules above. |
| `QuotedMessage` | object | no | Optional quoted message payload for custom reply preview using extendedTextMessage. |
| `QuotedMessage.extendedTextMessage` | object | no |  |
| `QuotedMessage.extendedTextMessage.text` | string | no | ej. `Original message text` |

### POST `/chat/send/edit`

**Edits a previously sent message**

Edits a message already sent by the same user. Provide the message ID and new content. MentionAll=true or a standalone @everyone mentions all group members; visible text is preserved. Explicit ContextInfo.MentionedJID supports ghost mentions.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Body` | string | **sí** | New message content |
| `Id` | string | **sí** | The ID of the message to edit |
| `MentionAll` | boolean | no | Mention all current group participants without visible phone numbers. A standalone @everyone also enables this; text is preserved. Direct chats are rejected and participant lookup failures abort sending. |
| `Phone` | string | **sí** | The WhatsApp number or JID (use 'me:' prefix if your own message) |

### POST `/chat/send/image`

**Sends an image/picture message**

Sends an image message (must be base64 encoded in image/png or image/jpeg formats) MentionAll=true or a standalone @everyone mentions all group members; visible text is preserved. Explicit ContextInfo.MentionedJID supports ghost mentions.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Caption` | string | no | ej. `Image Description` |
| `ContextInfo` | object | no | Optional context info for replies |
| `ContextInfo.IsForwarded` | boolean | no | Set to true to mark the message as forwarded. This is the preferred method for forwarding messages. |
| `ContextInfo.MentionedJID` | array<string> | no | Array of JIDs to mention in the message. Use full WhatsApp JID format (number@s.whatsapp.net). |
| `ContextInfo.Participant` | string | no | JID of original message sender |
| `ContextInfo.StanzaId` | string | no | Message ID to reply to |
| `Id` | string | no | ej. `ABCDABCD1234` |
| `Image` | string | **sí** | ej. `data:image/jpeg;base64,iVBORw0` |
| `MentionAll` | boolean | no | Mention all current group participants without visible phone numbers. A standalone @everyone also enables this; text is preserved. Direct chats are rejected and participant lookup failures abort sending. |
| `Phone` | string | **sí** | Destination phone digits (optional leading +) or full WhatsApp JID, including @lid; use @g.us for groups where supported. Bare numeric IDs use cached PN/LID mappings with a phone-number fallback. Usernames and BSUIDs are not supported. See the message destination rules above. |
| `QuotedMessage` | object | no | Optional quoted message payload for custom reply preview using extendedTextMessage. |
| `QuotedMessage.extendedTextMessage` | object | no |  |
| `QuotedMessage.extendedTextMessage.text` | string | no | ej. `Original message text` |

### POST `/chat/send/list`

**Sends a List message**

Sends a List message

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `ButtonText` | string | no | ej. `Click Here` |
| `ContextInfo` | object | no |  |
| `ContextInfo.Participant` | string | **sí** | ej. `5491155553935@s.whatsapp.net` |
| `ContextInfo.StanzaID` | string | **sí** | ej. `3EB06F9067F80BAB89FF` |
| `Desc` | string | **sí** | ej. `This is a list` |
| `FooterText` | string | no | ej. `This is a footer text` |
| `Id` | string | no | ej. `ABCDABCD1234` |
| `List` | array<object> | no |  |
| `List[].RowId` | string | no | ej. `1` |
| `List[].desc` | string | no | ej. `long description` |
| `List[].title` | string | no | ej. `menu option 1` |
| `Phone` | string | **sí** | Destination phone digits (optional leading +) or full WhatsApp JID, including @lid; use @g.us for groups where supported. Bare numeric IDs use cached PN/LID mappings with a phone-number fallback. Usernames and BSUIDs are not supported. See the message destination rules above. |
| `Sections` | array<object> | no |  |
| `Sections[].rows` | array<object> | no |  |
| `Sections[].rows[].RowId` | string | no | ej. `1` |
| `Sections[].rows[].desc` | string | no | ej. `long description` |
| `Sections[].rows[].title` | string | no | ej. `menu option 1` |
| `Sections[].title` | string | no | ej. `Menu` |
| `TopText` | string | no | ej. `This is a list` |

### POST `/chat/send/location`

**Sends a location message**

Sends a location message

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `ContextInfo` | object | no | Optional context info for replies |
| `ContextInfo.IsForwarded` | boolean | no | Set to true to mark the message as forwarded. This is the preferred method for forwarding messages. |
| `ContextInfo.MentionedJID` | array<string> | no | Array of JIDs to mention in the message. Use full WhatsApp JID format (number@s.whatsapp.net). |
| `ContextInfo.Participant` | string | no | JID of original message sender |
| `ContextInfo.StanzaId` | string | no | Message ID to reply to |
| `Id` | string | no | ej. `ABCDABCD1234` |
| `Latitude` | float | **sí** | ej. `48.85837` |
| `Longitude` | float | **sí** | ej. `2.294481` |
| `Name` | string | no | ej. `Party` |
| `Phone` | string | **sí** | Destination phone digits (optional leading +) or full WhatsApp JID, including @lid; use @g.us for groups where supported. Bare numeric IDs use cached PN/LID mappings with a phone-number fallback. Usernames and BSUIDs are not supported. See the message destination rules above. |
| `QuotedMessage` | object | no | Optional quoted message payload for custom reply preview using extendedTextMessage. |
| `QuotedMessage.extendedTextMessage` | object | no |  |
| `QuotedMessage.extendedTextMessage.text` | string | no | ej. `Original message text` |

### POST `/chat/send/poll`

**Sends a Poll to some group**

Sends a Poll message. Group should contain the gid (group id), similar to 120363312246943103@g.us.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Group` | string | **sí** | ej. `120363417042313103@g.us` |
| `Header` | string | **sí** | ej. `What's your favorite color` |
| `Id` | string | no | ej. `3EB06F9067F80BAB89FF` |
| `Options` | array<string> | **sí** | An array of options for the poll. |
| `SelectableCount` | integer | no | Optional. How many options each voter may pick. 1 (default) for a single answer, 0 for any number, or up to the number of options. |

### POST `/chat/send/raw`

**Send Raw Message**

Send a WhatsApp protobuf message as JSON. Experimental: unknown protobuf fields and empty messages are rejected. Internal protocolMessage, senderKeyDistributionMessage, fastRatchetKeySenderKeyDistributionMessage, and deviceSentMessage fields are rejected at any nesting level; use dedicated API operations for edits and revokes. Other recognized protobuf content is passed through without type-specific validation; WhatsApp acceptance and rendering are not guaranteed. Successful sends are saved when history is enabled and publish the standard sent-message event to RabbitMQ when configured.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Id` | string | no | Optional message ID |
| `Message` | object | **sí** | WhatsApp Message protobuf JSON |
| `Phone` | string | **sí** | Destination JID or phone digits |

### POST `/chat/send/sticker`

**Sends a sticker message**

Sends a sticker message (must be base64 encoded in image/webp or video/mp4 format)

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `ContextInfo` | object | no | Optional context info for replies |
| `ContextInfo.IsForwarded` | boolean | no | Set to true to mark the message as forwarded. This is the preferred method for forwarding messages. |
| `ContextInfo.MentionedJID` | array<string> | no | Array of JIDs to mention in the message. Use full WhatsApp JID format (number@s.whatsapp.net). |
| `ContextInfo.Participant` | string | no | JID of original message sender |
| `ContextInfo.StanzaId` | string | no | Message ID to reply to |
| `Emojis` | array<string> | no | ej. `[😀 🎉]` |
| `Id` | string | no | ej. `ABCDABCD1234` |
| `MimeType` | string | no | ej. `image/webp` |
| `PackId` | string | no | ej. `my.sticker.pack.id` |
| `PackName` | string | no | ej. `My Pack` |
| `PackPublisher` | string | no | ej. `Wuzapi` |
| `Phone` | string | **sí** | Destination phone digits (optional leading +) or full WhatsApp JID, including @lid; use @g.us for groups where supported. Bare numeric IDs use cached PN/LID mappings with a phone-number fallback. Usernames and BSUIDs are not supported. See the message destination rules above. |
| `PngThumbnail` | string | no | ej. `AA00D010` |
| `QuotedMessage` | object | no | Optional quoted message payload for custom reply preview using extendedTextMessage. |
| `QuotedMessage.extendedTextMessage` | object | no |  |
| `QuotedMessage.extendedTextMessage.text` | string | no | ej. `Original message text` |
| `Sticker` | string | **sí** | ej. `data:image/webp;base64,iVBORw0` |

### POST `/chat/send/template`

> **No disponible:** `routes.go` tiene esta ruta comentada; el spec la documenta pero el servidor no la expone.

**Sends a template message**

Sends a template message, that can contain quick reply buttons, url buttons and call buttons

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Buttons` | object | no | ej. `[map[DisplayText:Yes Type:quickreply] map[DisplayText:No Type:quickreply] map[DisplayText:Visit Site Type:url Url:https://www.fop2.com] map[DisplayText:Callme PhoneNumber:1155553934 Type:call]]` |
| `Buttons.DisplayText` | string | no | ej. `Text for Button` |
| `Buttons.Type` | quickreply|url|call | no |  |
| `Content` | string | **sí** | ej. `Message title` |
| `ContextInfo` | object | no |  |
| `ContextInfo.Participant` | string | **sí** | ej. `5491155553935@s.whatsapp.net` |
| `ContextInfo.StanzaId` | string | **sí** | ej. `3EB06F9067F80BAB89FF` |
| `Footer` | string | no | ej. `Text below title, above buttons` |
| `Id` | string | no | ej. `ABCDABCD1234` |
| `Phone` | string | **sí** | ej. `5491155553935` |

### POST `/chat/send/text`

**Sends a text message**

Sends a text message. Phone and Body are mandatory. If no Id is supplied, a random one will be generated. ContextInfo is optional and used when repyling to some message. StanzaId is the message id we are replying to and participant who wrote that message. If sending a new message, ContextInfo can be ommited altogether. MentionAll=true or a standalone @everyone mentions all group members; visible text is preserved. Explicit ContextInfo.MentionedJID supports ghost mentions.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Body` | string | **sí** | ej. `How you doin` |
| `ContextInfo` | object | no | Optional context info for replies |
| `ContextInfo.IsForwarded` | boolean | no | Set to true to mark the message as forwarded. This is the preferred method for forwarding messages. |
| `ContextInfo.MentionedJID` | array<string> | no | Array of JIDs to mention in the message. Use full WhatsApp JID format (number@s.whatsapp.net). |
| `ContextInfo.Participant` | string | no | JID of original message sender |
| `ContextInfo.StanzaId` | string | no | Message ID to reply to |
| `Id` | string | no | ej. `ABCDABCD1234` |
| `LinkPreview` | boolean | no | Set to true to enable link preview generation (default is false) |
| `MentionAll` | boolean | no | Mention all current group participants without visible phone numbers. A standalone @everyone also enables this; text is preserved. Direct chats are rejected and participant lookup failures abort sending. |
| `Phone` | string | **sí** | Destination phone digits (optional leading +) or full WhatsApp JID, including @lid; use @g.us for groups where supported. Bare numeric IDs use cached PN/LID mappings with a phone-number fallback. Usernames and BSUIDs are not supported. See the message destination rules above. |
| `QuotedMessage` | object | no | Optional quoted message payload for custom reply preview using extendedTextMessage. |
| `QuotedMessage.extendedTextMessage` | object | no |  |
| `QuotedMessage.extendedTextMessage.text` | string | no | ej. `Original message text` |
| `QuotedText` | string | no | Text content of the message being replied to (for displaying quote preview) |

### POST `/chat/send/video`

**Sends a video message**

Sends a video message (must be base64 encoded in video/mp4 or video/3gpp format. Only H.264 video codec and AAC audio codec is supported.) MentionAll=true or a standalone @everyone mentions all group members; visible text is preserved. Explicit ContextInfo.MentionedJID supports ghost mentions.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Caption` | string | no | ej. `my video` |
| `ContextInfo` | object | no | Optional context info for replies |
| `ContextInfo.IsForwarded` | boolean | no | Set to true to mark the message as forwarded. This is the preferred method for forwarding messages. |
| `ContextInfo.MentionedJID` | array<string> | no | Array of JIDs to mention in the message. Use full WhatsApp JID format (number@s.whatsapp.net). |
| `ContextInfo.Participant` | string | no | JID of original message sender |
| `ContextInfo.StanzaId` | string | no | Message ID to reply to |
| `Id` | string | no | ej. `ABCDABCD1234` |
| `JpegThumbnail` | string | no | ej. `AA00D010` |
| `MentionAll` | boolean | no | Mention all current group participants without visible phone numbers. A standalone @everyone also enables this; text is preserved. Direct chats are rejected and participant lookup failures abort sending. |
| `Phone` | string | **sí** | Destination phone digits (optional leading +) or full WhatsApp JID, including @lid; use @g.us for groups where supported. Bare numeric IDs use cached PN/LID mappings with a phone-number fallback. Usernames and BSUIDs are not supported. See the message destination rules above. |
| `QuotedMessage` | object | no | Optional quoted message payload for custom reply preview using extendedTextMessage. |
| `QuotedMessage.extendedTextMessage` | object | no |  |
| `QuotedMessage.extendedTextMessage.text` | string | no | ej. `Original message text` |
| `Video` | string | **sí** | ej. `data:video/mp4;base64,iVBORw0` |

### POST `/chat/send/voice`

**Convert and send a browser voice recording**

HTTP-only multipart upload. Requires FFmpeg with libopus. Input is limited to 16 MiB; output is OGG/Opus, mono 48 kHz at 24 kbit/s, capped at five minutes. Conversion times out after 45 seconds. Existing JSON audio and stdio audio methods are unchanged.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`multipart/form-data`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Audio` | string | **sí** |  |
| `Id` | string | no | Optional message ID |
| `Phone` | string | **sí** | Destination phone digits or full WhatsApp JID, including @lid and supported group JIDs. |
| `Seconds` | integer | no | Optional duration metadata for the recording |

Respuestas: `200` Normal audio response with Details, Timestamp and Id in data · `400` Invalid destination or malformed/oversized recording · `401` Invalid user token · `422` Audio conversion failed or FFmpeg/libopus unavailable · `500` Session or send failure

