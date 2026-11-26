# API · Grupos

Crear y administrar grupos, participantes, invitaciones y ajustes.

Convenciones generales (autenticación, respuestas, destinatarios): [../api-guia-ia.md](../api-guia-ia.md). Este archivo se generó desde `static/api/spec.yml`.

### POST `/group/announce`

**Set group announce mode**

Enables or disables "announce" mode (admin-only messages) for the specified group.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Announce` | boolean | **sí** | Whether to enable (true) or disable (false) announce mode |
| `GroupJID` | string | **sí** | The JID of the group to set announce mode |

### POST `/group/create`

**Create a new WhatsApp group**

Creates a new WhatsApp group with the specified name and participants.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `MemberAddMode` | string (admin_add, all_member_add) | no | Optional. Who can add participants to the new group. When omitted, whatsmeow's default applies (all_member_add). |
| `Name` | string | **sí** | The name for the new group |
| `Participants` | array<string> | **sí** | ej. `[5491112345678 5491123456789]` |

### POST `/group/ephemeral`

**Set disappearing timer for group messages**

Configures ephemeral/disappearing messages for the group. Messages will automatically disappear after the specified duration.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Duration` | string (24h, 7d, 90d, off) | **sí** | Duration for disappearing messages. Use "24h" for 24 hours, "7d" for 7 days, "90d" for 90 days, or "off" to disable. |
| `GroupJID` | string | **sí** | The JID of the group to configure ephemeral messages |

### GET `/group/info`

**Gets group information**

Retrieves information about a specific group

Autenticación: token de usuario (cabecera `token`).

| Parámetro | En | Tipo | Requerido | Descripción |
|---|---|---|---|---|
| `groupJID` | query | string | **sí** | The JID of the group to retrieve information from |

### POST `/group/inviteinfo`

**Get information about a group invite code**

Returns details about a WhatsApp group given an invite code.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Code` | string | **sí** | The group invite code to get information for |

### GET `/group/invitelink`

**Get Group Invite Link**

Gets the invite link for a group, optionally resetting it to create a new/different one

Autenticación: token de usuario (cabecera `token`).

| Parámetro | En | Tipo | Requerido | Descripción |
|---|---|---|---|---|
| `groupJID` | query | string | **sí** | The JID of the group to retrieve information from |
| `reset` | query | boolean | no | Whether to revoke the old invite link and generate a new one (default is false) |

### POST `/group/join`

**Join a WhatsApp group via invite code**

Joins the WhatsApp group using the given invite code.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Code` | string | **sí** | The invite code or link to join the group |

### POST `/group/joinapprovalmode`

**Toggle group join approval mode**

Enables or disables the requirement that new members be approved by an admin before joining the group.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `groupjid` | string | **sí** | The JID of the group |
| `mode` | boolean | **sí** | true to require admin approval for new members, false to disable it |

### POST `/group/leave`

**Leave a WhatsApp group**

Removes the authenticated user from the specified group.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `GroupJID` | string | **sí** | The JID of the group to leave (e.g., 120363312246943103@g.us) |

### GET `/group/list`

**List subscribed groups**

Returns complete list of subscribed groups

Autenticación: token de usuario (cabecera `token`).

### POST `/group/locked`

**Set group locked status**

Configures whether only admins can modify group info (locked) or all participants can modify (unlocked).

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `GroupJID` | string | **sí** | The JID of the group to configure |
| `Locked` | boolean | **sí** | Whether to lock the group (true) or unlock it (false). When locked, only admins can modify group info. |

### POST `/group/memberaddmode`

**Set group member add mode**

Configures who can add participants to the group, only admins (admin_add) or any participant (all_member_add).

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `GroupJID` | string | **sí** | The JID of the group to configure |
| `Mode` | string (admin_add, all_member_add) | **sí** | admin_add to let only admins add participants, all_member_add to let any participant add them. |

### POST `/group/name`

**Change group name**

Updates the name of the specified WhatsApp group.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `GroupJID` | string | **sí** | The JID of the group to rename |
| `Name` | string | **sí** | The new name for the group |

### POST `/group/photo`

**Changes group photo**

Allows you to change a group photo/image. Returns the Picture ID number

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `GroupJID` | string | no | ej. `120362023605733675@g.us` |
| `Image` | string | no | Base64 encoded image data with data URL format. Supported format: JPEG! |

### POST `/group/photo/remove`

**Remove group photo**

Removes the current photo/image from the specified WhatsApp group.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `GroupJID` | string | **sí** | The JID of the group to remove the photo from |

### GET `/group/requestparticipants`

**List pending join requests**

Lists participants who have requested to join the group. Requires join approval mode to be enabled and the session to be an admin of the group.

Autenticación: token de usuario (cabecera `token`).

| Parámetro | En | Tipo | Requerido | Descripción |
|---|---|---|---|---|
| `groupJID` | query | string | **sí** | The JID of the group |

### POST `/group/topic`

**Set group topic/description**

Updates the topic or description of the specified WhatsApp group.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `GroupJID` | string | **sí** | The JID of the group to set the topic for |
| `Topic` | string | **sí** | The new topic/description for the group |

### POST `/group/updateparticipants`

**Add, remove, promote or demote participants from a group**

Adds or removes participants from the specified WhatsApp group.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Action` | string (add, remove, promote, demote) | **sí** | Action to perform ("add" to add participants, "remove" to remove participants, "promote" to promote participants, "demote" to demote participants.) |
| `GroupJID` | string | **sí** | The JID of the group |
| `Phone` | array<string> | **sí** | ej. `[5491112345678 5491123456789@s.whatsapp.net]` |

### POST `/group/updaterequestparticipants`

**Approve or reject pending join requests**

Approves or rejects participants who requested to join the group.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Action` | string (approve, reject) | **sí** | Action to perform ("approve" to accept join requests, "reject" to decline them) |
| `GroupJID` | string | **sí** | The JID of the group |
| `Phone` | array<string> | **sí** | ej. `[70072425046185@lid]` |

