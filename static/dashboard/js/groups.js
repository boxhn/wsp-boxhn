// Administrador de grupos JavaScript
// Manages all WhatsApp groups functionality
// 
// ADMIN PERMISSIONS: Modified to always show admin actions and let backend handle permissions
// This ensures all group management features are visible to users

let groupsCache = {};
let contactsCache = {};
let currentGroupId = null;
let groupsUpdateInterval = null;

// Function to identify group type based on API data
function identificarTipo(data) {
    if (data.IsParent === true) {
        return "COMMUNITY";
    }
    
    if (data.LinkedParentJID !== "" && data.LinkedParentJID !== null) {
        return "COMMUNITY_GROUP";
    }
    
    return "NORMAL_GROUP";
}

// Function to get group type label and icon
// Texto en español de la etiqueta de tipo. La etiqueta en inglés se conserva como valor interno
// (data-group-type y comparaciones del filtro); solo se traduce lo que se muestra.
function etiquetaTipo(label) {
    return { "Community": "Comunidad", "Community Group": "Grupo de comunidad", "Group": "Grupo" }[label] || label;
}

function getGroupTypeInfo(groupData) {
    const tipo = identificarTipo(groupData);
    
    switch (tipo) {
        case "COMMUNITY":
            return {
                label: "Community",
                icon: "building",
                color: "purple",
                description: "Comunidad principal"
            };
        case "COMMUNITY_GROUP":
            return {
                label: "Community Group",
                icon: "users",
                color: "blue",
                description: "Grupo dentro de una comunidad"
            };
        case "NORMAL_GROUP":
        default:
            return {
                label: "Group",
                icon: "users",
                color: "green",
                description: "Grupo normal"
            };
    }
}

// API function to get contacts without automatic download
async function getContactsForGroups() {
    const token = getLocalStorageItem('token');
    const myHeaders = new Headers();
    myHeaders.append('token', token);
    myHeaders.append('Content-Type', 'application/json');
    try {
        const res = await fetch(baseUrl + "/user/contacts", {
            method: "GET",
            headers: myHeaders,
        });
        const data = await res.json();
        if (data.code === 200) {
            const transformedContacts = Object.entries(data.data).map(([phone, contact]) => ({
                FullName: contact.FullName || "",
                PushName: contact.PushName || "",
                Phone: phone.split('@')[0] // Remove the @s.whatsapp.net part
            }));
            // Return contacts without downloading - for dashboard use
            return transformedContacts;
        } else {
            throw new Error(`API returned code ${data.code}`);
        }
    } catch (error) {
        console.error("Error fetching contacts:", error);
        throw error;
    }
}

// Initialize groups functionality when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeGroupsEvents();
    initializeGroupsModals();
});

function initializeGroupsEvents() {
    // Main dashboard group cards
    $('#groupsList').on('click', function() {
        showGroupsManager();
    });

    $('#createGroup').on('click', function() {
        showCreateGroupModal();
    });

    $('#joinGroup').on('click', function() {
        showJoinGroupModal();
    });

    // Groups manager events
    $('#backToDashboard').on('click', function() {
        hideGroupsManager();
    });

    $('#createNewGroup, #createFirstGroup').on('click', function() {
        showCreateGroupModal();
    });

    // Refresh groups
    $('#refreshGroups').on('click', function() {
        loadGroups();
    });

    // Search and filter
    $('#groupsSearch').on('input', function() {
        filterGroups();
    });

    $('#groupsFilter').on('change', function() {
        filterGroups();
    });
}

function initializeGroupsModals() {
    // Initialize dropdowns
    $('#groupsFilter').dropdown();
    $('#participantsDropdown').dropdown({
        allowAdditions: true,
        hideAdditions: false
    });
    $('#addParticipantsDropdown').dropdown({
        allowAdditions: true,
        hideAdditions: false
    });
    $('#disappearingTimerSelect').dropdown();

    // Load contacts button event
    $('#loadContactsBtn').on('click', async function() {
        const button = $(this);
        const statusDiv = $('#contactsStatus');
        const statusText = $('#contactsStatusText');
        
        // Show loading state
        button.addClass('loading').prop('disabled', true);
        statusDiv.show().removeClass('success error').addClass('info');
        statusText.text('Cargando contactos…');
        
        try {
            await loadContacts();
            populateParticipantsDropdown();
            
            // Show success state
            statusDiv.removeClass('info').addClass('success');
            statusText.html('<i class="fas fa-check"></i> Contactos cargados. Ya puedes elegir participantes.');
            
            // Hide status after 3 seconds
            setTimeout(() => {
                statusDiv.fadeOut();
            }, 3000);
            
        } catch (error) {
            console.error('Error loading contacts:', error);
            statusDiv.removeClass('info').addClass('error');
            statusText.html('<i class="fas fa-triangle-exclamation"></i> No se pudieron cargar los contactos. Inténtalo de nuevo.');
        } finally {
            button.removeClass('loading').prop('disabled', false);
        }
    });

    // Load contacts for participants management
    $('#loadContactsForParticipantsBtn').on('click', async function() {
        const button = $(this);
        const statusDiv = $('#participantsContactsStatus');
        const statusText = $('#participantsContactsStatusText');
        
        button.addClass('loading').prop('disabled', true);
        statusDiv.show().removeClass('success error').addClass('info');
        statusText.text('Cargando contactos…');
        
        try {
            await loadContacts();
            populateAddParticipantsDropdown();
            
            statusDiv.removeClass('info').addClass('success');
            statusText.html('<i class="fas fa-check"></i> Contactos cargados.');
            
            setTimeout(() => {
                statusDiv.fadeOut();
            }, 3000);
            
        } catch (error) {
            console.error('Error loading contacts:', error);
            statusDiv.removeClass('info').addClass('error');
            statusText.html('<i class="fas fa-triangle-exclamation"></i> No se pudieron cargar los contactos. Inténtalo de nuevo.');
        } finally {
            button.removeClass('loading').prop('disabled', false);
        }
    });

    // File input events for group photo
    $('#changeGroupPhotoBtn').on('click', function() {
        $('#groupPhotoInput').click();
    });

    $('#groupPhotoInput').on('change', function() {
        if (this.files && this.files[0]) {
            // Handle photo upload
            uploadGroupPhoto(this.files[0]);
        }
    });

    // Form submissions
    $('#createGroupSubmit').on('click', function() {
        createGroup();
    });

    $('#joinGroupSubmit').on('click', function() {
        joinGroup();
    });

    $('#previewGroupBtn').on('click', function() {
        previewGroup();
    });

    $('#saveGroupInfoBtn').on('click', function() {
        saveGroupInfo();
    });

    $('#saveGroupSettingsBtn').on('click', function() {
        saveGroupSettings();
    });

    // Group action buttons
    $('#editGroupInfoBtn').on('click', function() {
        showEditGroupInfoModal();
    });

    $('#manageParticipantsBtn').on('click', function() {
        showManageParticipantsModal();
    });

    $('#groupSettingsBtn').on('click', function() {
        showGroupSettingsModal();
    });

    $('#groupInviteLinkBtn').on('click', function() {
        showGroupInviteLinkModal();
    });

    $('#leaveGroupBtn').on('click', function() {
        confirmLeaveGroup();
    });

    // Participant management
    $('#addParticipantsBtn').on('click', function() {
        addParticipants();
    });

    // Settings actions
    $('#copyInviteLinkBtn').on('click', function() {
        copyInviteLink();
    });

    $('#resetInviteLinkBtn').on('click', function() {
        resetInviteLink();
    });

    $('#removeGroupPhotoBtn').on('click', function() {
        removeGroupPhoto();
    });
}

function showGroupsManager() {
    // Hide only the main dashboard content, not the header
    $('#mainDashboard').addClass('hidden');
    $('#groupsMainContainer').removeClass('hidden');
    loadGroups();
}

function hideGroupsManager() {
    $('#groupsMainContainer').addClass('hidden');
    // Show only the main dashboard content, not affecting the header
    $('#mainDashboard').removeClass('hidden');
    if (groupsUpdateInterval) {
        clearInterval(groupsUpdateInterval);
        groupsUpdateInterval = null;
    }
}

async function loadGroups() {
    try {
        $('#groupsLoading').addClass('active');
        $('#noGroupsMessage').addClass('hidden');
        
        // Try to get user JID first and ensure it's properly stored
        const userJID = await getUserInfoAndSetJID();
        
        // Also try to get it from the stored token data
        if (!userJID) {
            // Try to get from localStorage with proper parsing
            const storedJID = getLocalStorageItem('currentUserJID');
            if (storedJID) {
                window.currentUserJID = storedJID;
            }
        }
        
        const response = await getGroups();
        
        if (response.code === 200 && response.data && response.data.Groups) {
            groupsCache = response.data;
            displayGroups(response.data.Groups || []);
        } else {
            showError('No se cargaron los grupos: ' + (response.error || 'Error desconocido'));
            $('#noGroupsMessage').removeClass('hidden');
        }
    } catch (error) {
        console.error('Error al cargar los grupos:', error);
        showError('Error al cargar los grupos');
        $('#noGroupsMessage').removeClass('hidden');
    } finally {
        $('#groupsLoading').removeClass('active');
    }
}

function displayGroups(groups) {
    const container = $('#groupsListContainer');
    container.empty();

    if (!groups || groups.length === 0) {
        $('#noGroupsMessage').removeClass('hidden');
        return;
    }

    $('#noGroupsMessage').addClass('hidden');

    groups.forEach(group => {
        const groupItem = createGroupListItem(group);
        container.append(groupItem);
    });
}

// Function to format disappearing timer
function formatDisappearingTimer(seconds) {
    if (!seconds || seconds === 0) return null;
    
    // WhatsApp specific disappearing message options
    switch (seconds) {
        case 86400:     // 24 horas
            return "24 horas";
        case 604800:    // 7 días
            return "7 días";
        case 7776000:   // 90 días
            return "90 días";
        default:
            // Fallback for any other values
            const days = Math.floor(seconds / 86400);
            if (days > 0) {
                return `${days} day${days > 1 ? 's' : ''}`;
            } else {
                const hours = Math.floor(seconds / 3600);
                return `${hours} hour${hours > 1 ? 's' : ''}`;
            }
    }
}

function createGroupListItem(group) {
    const participantCount = group.Participants ? group.Participants.length : 0;
    const currentUserJID = getCurrentUserJID();
    const isAdmin = checkIfUserIsAdmin(group, currentUserJID);
    const isSuperAdmin = checkIfUserIsSuperAdmin(group, currentUserJID);
    
    // Count admins and super admins
    const admins = group.Participants ? group.Participants.filter(p => p.IsAdmin && !p.IsSuperAdmin) : [];
    const superAdmins = group.Participants ? group.Participants.filter(p => p.IsSuperAdmin) : [];
    
    // Get group type information
    const typeInfo = getGroupTypeInfo(group);
    
    // Format creation date
    const createdDate = group.GroupCreated ? new Date(group.GroupCreated).toLocaleDateString('en-US') : 'Unknown';
    
    // Truncate topic if too long
    const topic = group.Topic || 'Sin descripción';
    const truncatedTopic = truncateText(topic, 100);
    
    // User role badge
    let userRoleBadge = '';
    if (isSuperAdmin) {
        userRoleBadge = '<span class="box-badge box-badge-danger"><i class="fas fa-shield"></i>Superadministrador</span>';
    } else if (isAdmin) {
        userRoleBadge = '<span class="box-badge box-badge-warning"><i class="fas fa-star"></i>Administrador</span>';
    }
    
    // Build features badges
    let featureBadges = '';
    if (group.IsAnnounce) {
        featureBadges += '<span class="box-badge"><i class="fas fa-bullhorn"></i>Solo administradores</span>';
    }
    if (group.IsLocked) {
        featureBadges += '<span class="box-badge"><i class="fas fa-lock"></i>Bloqueado</span>';
    }
    if (group.IsEphemeral && group.DisappearingTimer) {
        const timerText = formatDisappearingTimer(group.DisappearingTimer);
        featureBadges += `<span class="box-badge"><i class="fas fa-clock"></i>Desaparecen en ${timerText}</span>`;
    }
    if (group.IsJoinApprovalRequired) {
        featureBadges += '<span class="box-badge"><i class="fas fa-check"></i>Requiere aprobación</span>';
    }
    
    // Show linked parent for community groups
    let parentInfo = '';
    if (typeInfo.label === 'Community Group' && group.LinkedParentJID) {
        const parentGroup = groupsCache.Groups ? groupsCache.Groups.find(g => g.JID === group.LinkedParentJID) : null;
        const parentName = parentGroup ? parentGroup.Name : 'Unknown Community';
        parentInfo = `<div class="meta"><i class="fas fa-sitemap"></i>Parte de: ${escapeHtml(parentName)}</div>`;
    }
    
    return `
        <div class="item group-list-item" data-group-id="${group.JID}" data-is-admin="${isAdmin}" data-is-super-admin="${isSuperAdmin}" data-group-type="${typeInfo.label}">
            <div class="wsp-grid">
                <div class="wsp-col-1">
                    <i class="fas fa-${typeInfo.icon} wsp-tipo-${typeInfo.color}"></i>
                </div>
                <div class="wsp-col-11">
                    <div class="content">
                        <div class="header">
                            ${escapeHtml(group.Name || 'Grupo sin nombre')}
                            <span class="box-badge ${typeInfo.color === 'green' ? 'box-badge-success' : 'box-badge-primary'}">${etiquetaTipo(typeInfo.label)}</span>
                            ${userRoleBadge}
                        </div>
                        ${parentInfo}
                        <div class="description group-description" data-full-text="${escapeHtml(topic)}">
                            ${escapeHtml(truncatedTopic)}
                            ${topic.length > 100 ? ' <a href="#" class="read-more-link" onclick="toggleDescription(this)">Leer más</a>' : ''}
                        </div>
                        <div class="meta">
                            <span><i class="fas fa-users"></i>${participantCount} participants</span>
                            ${admins.length > 0 ? `<span><i class="fas fa-star"></i>${admins.length} admins</span>` : ''}
                            ${superAdmins.length > 0 ? `<span><i class="fas fa-shield"></i>${superAdmins.length} super admins</span>` : ''}
                            <span><i class="fas fa-calendar"></i>Created ${createdDate}</span>
                        </div>
                        <div class="meta">
                            <span><i class="fas fa-hashtag"></i><code>${group.JID}</code></span>
                            <a href="#" onclick="copyGroupId(event, '${group.JID}')"><i class="fas fa-copy"></i>Copiar ID</a>
                        </div>
                        <div class="meta">
                            ${featureBadges}
                        </div>
                    </div>
                </div>
                <div class="wsp-col-4">
                    <div class="">
                        <button class="box-btn" onclick="viewGroupDetails('${group.JID}')">
                            <i class="fas fa-eye"></i> View
                        </button>
                        ${(isAdmin || isSuperAdmin) ? 
                            `<button class="box-btn secondary" onclick="manageGroup('${group.JID}')">
                                <i class="fas fa-gear"></i> Manage
                            </button>` : ''
                        }
                    </div>
                </div>
            </div>
            <div class="box-divider"></div>
        </div>
    `;
}

async function viewGroupDetails(groupJID) {
    try {
        currentGroupId = groupJID;
        
        const response = await getGroupInfo(groupJID);
        
        if (response.code === 200 && response.data) {
            populateGroupDetailsModal(response.data);
            $('#modalGroupDetails').modal('show');
        } else {
            showError('No se cargaron los detalles del grupo: ' + (response.error || response.message || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Error loading group details:', error);
        showError('Error al cargar los detalles del grupo: ' + error.message);
    }
}

function populateGroupDetailsModal(groupData) {
    const typeInfo = getGroupTypeInfo(groupData);
    const currentUserJID = getCurrentUserJID();
    const isAdmin = checkIfUserIsAdmin(groupData, currentUserJID);
    const isSuperAdmin = checkIfUserIsSuperAdmin(groupData, currentUserJID);
       
    if (groupData.Participants) {
        groupData.Participants.forEach((p, index) => {
            const participantPhone = extractPhoneFromJID(p.JID);
            const currentUserPhone = extractPhoneFromJID(currentUserJID);
            const isMatch = participantPhone === currentUserPhone;
            if (isMatch) {
                //console.log(`Phone Match: ${currentUserPhone} - ${participantPhone}`);
                //console.log(`  ${index + 1}. JID: ${p.JID}, Phone: ${participantPhone}, IsAdmin: ${p.IsAdmin}, IsSuperAdmin: ${p.IsSuperAdmin}`);
            }
        });
    }
    
    $('#groupDetailsTitle').text(groupData.Name || 'Detalles del grupo');
    $('#groupDetailsName').text(groupData.Name || 'Grupo sin nombre');
    $('#groupDetailsDescription').text(groupData.Topic || 'Sin descripción');
    $('#groupDetailsParticipants').text((groupData.Participants || []).length + ' participantes');
    
    // Format creation date
    const createdDate = groupData.GroupCreated ? new Date(groupData.GroupCreated).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : 'Unknown';
    $('#groupDetailsCreated').text(createdDate);

    // Show group type and features
    let featuresText = `${etiquetaTipo(typeInfo.label)}`;
    if (groupData.IsAnnounce) featuresText += ', Solo administradores';
    if (groupData.IsLocked) featuresText += ', Bloqueado';
    if (groupData.IsEphemeral && groupData.DisappearingTimer) {
        const timerText = formatDisappearingTimer(groupData.DisappearingTimer);
        featuresText += `, Disappearing messages (${timerText})`;
    }
    if (groupData.IsJoinApprovalRequired) featuresText += ', Requiere aprobación';
    
    // Add group features info
    if ($('#groupDetailsFeatures').length === 0) {
        $('#groupDetailsCreated').parent().after(`
            <div class="item">
                <div class="header">Tipo y características</div>
                <div id="groupDetailsFeatures">${featuresText}</div>
            </div>
        `);
    } else {
        $('#groupDetailsFeatures').text(featuresText);
    }

    // Show linked parent for community groups
    if (typeInfo.label === 'Community Group' && groupData.LinkedParentJID) {
        const parentGroup = groupsCache.Groups ? groupsCache.Groups.find(g => g.JID === groupData.LinkedParentJID) : null;
        const parentName = parentGroup ? parentGroup.Name : 'Unknown Community';
        
        if ($('#groupDetailsParent').length === 0) {
            $('#groupDetailsFeatures').parent().after(`
                <div class="item">
                    <div class="header">Comunidad principal</div>
                    <div id="groupDetailsParent">${escapeHtml(parentName)}</div>
                </div>
            `);
        } else {
            $('#groupDetailsParent').text(parentName);
        }
    } else {
        $('#groupDetailsParent').parent().remove();
    }

    // Show/hide admin actions based on user permissions
    const adminSection = $('#adminActionsSection');
    
    if (isAdmin || isSuperAdmin) {
        adminSection.show();
    } else {
        adminSection.hide();
    }

    // Always show placeholder since no photo URL is provided by API
    $('#groupDetailsPhoto').hide();
    $('#groupDetailsNoPhoto').show();

    // Participants list
    const participantsList = $('#groupParticipantsList');
    participantsList.empty();

    if (groupData.Participants && groupData.Participants.length > 0) {
        groupData.Participants.forEach(participant => {
            const phone = participant.JID ? participant.JID.split('@')[0] : 'Unknown';
            const participantIsAdmin = participant.IsAdmin || false;
            const participantIsSuperAdmin = participant.IsSuperAdmin || false;
            const currentUserPhone = extractPhoneFromJID(currentUserJID);
            const participantPhone = extractPhoneFromJID(participant.JID);
            const isCurrentUser = currentUserPhone && participantPhone && currentUserPhone === participantPhone;
            
            let actionButtons = '';
            
            // Show action buttons only if current user is admin/super admin and target is not current user
            if (!isCurrentUser && (isAdmin || isSuperAdmin)) {
                const buttons = [];
                
                // Remove button - available for admins
                buttons.push(`
                    <button class="box-btn box-btn-danger box-btn-sm" onclick="removeParticipant('${participant.JID}')" title="Quitar del grupo">
                        <i class="fas fa-minus"></i> Remove
                    </button>
                `);
                
                // Promote/Demote buttons - based on current user permissions
                if (isSuperAdmin) {
                    // Super admins can promote/demote anyone
                    if (!participantIsAdmin && !participantIsSuperAdmin) {
                        // Hacer administrador
                        buttons.push(`
                            <button class="box-btn box-btn-sm" onclick="promoteParticipant('${participant.JID}')" title="Hacer administrador">
                                <i class="fas fa-star"></i> Promote
                            </button>
                        `);
                    } else if (participantIsAdmin && !participantIsSuperAdmin) {
                        // Quitar como administrador
                        buttons.push(`
                            <button class="box-btn secondary box-btn-sm" onclick="demoteParticipant('${participant.JID}')" title="Quitar como administrador">
                                <i class="far fa-star"></i> Demote
                            </button>
                        `);
                    }
                } else if (isAdmin && !participantIsAdmin && !participantIsSuperAdmin) {
                    // Regular admins can only promote regular users to admin
                    buttons.push(`
                        <button class="box-btn box-btn-sm" onclick="promoteParticipant('${participant.JID}')" title="Hacer administrador">
                            <i class="fas fa-star"></i> Promote
                        </button>
                    `);
                }
                
                if (buttons.length > 0) {
                    actionButtons = `
                        <div class="">
                            ${buttons.join('')}
                        </div>
                    `;
                }
            }
            
            const participantItem = `
                <div class="item participant-item">
                    <div class="content">
                        <div class="participant-info">
                            <div class="header">${escapeHtml(participant.DisplayName || phone)}</div>
                            <div class="description">+${phone}</div>
                        </div>
                        <div class="participant-actions">
                            <div class="participant-labels">
                                ${participantIsSuperAdmin ? '<span class="box-badge box-badge-danger"><i class="fas fa-shield"></i>Superadministrador</span>' : 
                                  participantIsAdmin ? '<span class="box-badge box-badge-warning"><i class="fas fa-star"></i>Administrador</span>' : ''}
                                ${isCurrentUser ? '<span class="box-badge box-badge-primary">You</span>' : ''}
                            </div>
                            ${actionButtons}
                        </div>
                    </div>
                </div>
            `;
            participantsList.append(participantItem);
        });
    } else {
        participantsList.append('<div class="item">No se encontraron participantes</div>');
    }
}

function createParticipantItem(participant) {
    const phone = participant.JID ? participant.JID.split('@')[0] : 'Unknown';
    const isAdmin = participant.IsAdmin || false;
    const isSuperAdmin = participant.IsSuperAdmin || false;
    
    // Get current user JID to check if this participant is the current user
    const currentUserJID = getCurrentUserJID();
    const currentUserPhone = extractPhoneFromJID(currentUserJID);
    const participantPhone = extractPhoneFromJID(participant.JID);
    const isCurrentUser = currentUserPhone && participantPhone && currentUserPhone === participantPhone;
    
    return `
        <div class="item participant-item">
            <div class="content">
                <div class="participant-info">
                    <div class="header">${escapeHtml(participant.DisplayName || phone)}</div>
                    <div class="description">+${phone}</div>
                </div>
                <div class="participant-actions">
                    <div class="participant-labels">
                        ${isSuperAdmin ? '<span class="box-badge box-badge-danger"><i class="fas fa-shield"></i>Superadministrador</span>' : 
                          isAdmin ? '<span class="box-badge box-badge-warning"><i class="fas fa-star"></i>Administrador</span>' : ''}
                        ${isCurrentUser ? '<span class="box-badge box-badge-primary">You</span>' : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function copyGroupId(event, jid) {
    event.preventDefault();
    navigator.clipboard.writeText(jid).then(() => {
        $.toast({ class: 'success', message: 'ID del grupo copiado' });
    }).catch(() => {
        $.toast({ class: 'error', message: 'No se pudo copiar el ID del grupo' });
    });
}

function filterGroups() {
    const searchTerm = $('#groupsSearch').val().toLowerCase();
    const filterType = $('#groupsFilter').val();
    
    $('.group-list-item').each(function() {
        const item = $(this);
        const groupName = item.find('.header').first().text().toLowerCase();
        const groupDescription = item.find('.group-description').attr('data-full-text').toLowerCase();
        const groupType = item.attr('data-group-type').toLowerCase();
        
        let showItem = true;
        
        // Apply search filter
        if (searchTerm && !groupName.includes(searchTerm) && !groupDescription.includes(searchTerm)) {
            showItem = false;
        }
        
        // Apply type filter
        if (filterType === 'community' && !groupType.includes('community')) {
            showItem = false;
        } else if (filterType === 'normal' && groupType !== 'group') {
            showItem = false;
        } else if (filterType === 'community_group' && groupType !== 'community group') {
            showItem = false;
        }
        
        if (showItem) {
            item.show();
        } else {
            item.hide();
        }
    });
}

function showCreateGroupModal() {
    // Reset modal state
    const statusDiv = $('#contactsStatus');
    const statusText = $('#contactsStatusText');
    const dropdown = $('#participantsDropdown');
    
    // Clear previous contacts cache to force fresh load
    contactsCache = {};
    
    // Reset dropdown
    dropdown.dropdown('clear');
    dropdown.find('.menu').html('<div class="item disabled">No hay contactos cargados</div>');
    
    // Show initial status message
    statusDiv.show().removeClass('success error').addClass('info');
    statusText.html('<i class="fas fa-circle-info"></i> Pulsa "Cargar contactos" para llenar la lista de participantes.');
    
    $('#modalCreateGroup').modal('show');
}

async function loadContacts() {
    try {
        const response = await getContactsForGroups();
        if (response && Array.isArray(response)) {
            // Convert array format to object format expected by populateParticipantsDropdown
            contactsCache = {};
            response.forEach(contact => {
                const jid = contact.Phone + '@s.whatsapp.net';
                contactsCache[jid] = {
                    FullName: contact.FullName,
                    PushName: contact.PushName,
                    Phone: contact.Phone
                };
            });
        }
    } catch (error) {
        console.error('Error loading contacts:', error);
    }
}

function populateParticipantsDropdown() {
    const dropdown = $('#participantsDropdown .menu');
    dropdown.empty();
    
    if (contactsCache && typeof contactsCache === 'object' && Object.keys(contactsCache).length > 0) {
        Object.entries(contactsCache).forEach(([jid, contact]) => {
            const phone = contact.Phone;
            const name = contact.FullName || contact.PushName || phone;
            dropdown.append(`<div class="item" data-value="${phone}">${escapeHtml(name)} (+${phone})</div>`);
        });
        
        // Update dropdown placeholder
        $('#participantsDropdown .default.text').text('Selecciona participantes');
    } else {
        dropdown.append('<div class="item disabled">No hay contactos cargados. Pulsa "Cargar contactos" para llenar la lista.</div>');
        $('#participantsDropdown .default.text').text('Carga primero los contactos');
    }
    
    $('#participantsDropdown').dropdown('refresh');
}

async function createGroup() {
    try {
        const form = $('#createGroupForm');
        const formData = new FormData(form[0]);
        
        const groupName = formData.get('groupName');
        const participants = $('#participantsDropdown').dropdown('get value');
        
        if (!groupName || !participants || participants.length === 0) {
            showError('Completa todos los campos obligatorios');
            return;
        }
        
        // Convert participants to array of phone numbers (API expects array of strings)
        let participantNumbers;
        if (Array.isArray(participants)) {
            participantNumbers = participants;
        } else if (typeof participants === 'string') {
            // If it's a single string, split by comma and clean up
            participantNumbers = participants.split(',').map(p => p.trim()).filter(p => p.length > 0);
        } else {
            participantNumbers = [participants.toString()];
        }
        
        const createData = {
            name: groupName,
            participants: participantNumbers
        };
        
        const response = await createGroupAPI(createData);
        
        if (response.success || response.code === 200) {
            showSuccess('Grupo creado');
            $('#modalCreateGroup').modal('hide');
            form[0].reset();
            $('#participantsDropdown').dropdown('clear');
            loadGroups(); // Refresh groups list
        } else {
            showError('No se creó el grupo: ' + (response.error || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Error al crear el grupo:', error);
        showError('Error al crear el grupo');
    }
}

function showJoinGroupModal() {
    $('#modalJoinGroup').modal('show');
}

async function previewGroup() {
    try {
        const inviteCode = $('input[name="inviteCode"]').val().trim();
        if (!inviteCode) {
            showError('Ingresa un código o enlace de invitación');
            return;
        }
        
        // Extract code from full link if needed
        const code = extractInviteCode(inviteCode);
        
        const response = await getGroupInviteInfo(code);
        
        if (response.success && response.data) {
            displayGroupPreview(response.data);
        } else {
            showError('No se obtuvo la vista previa del grupo: ' + (response.error || 'Código de invitación inválido'));
        }
    } catch (error) {
        console.error('Error al ver la vista previa del grupo:', error);
        showError('Error al ver la vista previa del grupo');
    }
}

function displayGroupPreview(groupData) {
    const previewContainer = $('#groupPreviewContainer');
    const previewContent = $('#groupPreviewContent');
    
    previewContent.html(`
        <div class="wsp-grid">
            <div class="wsp-col-4">
                <div class="wsp-titulo">
                    <i class="fas fa-users"></i>
                </div>
            </div>
            <div class="wsp-col-12">
                <h4>${escapeHtml(groupData.Name || 'Unnamed Group')}</h4>
                <p>${escapeHtml(groupData.Topic || 'Sin descripción')}</p>
                <p><strong>Participants:</strong> ${groupData.Size || 0}</p>
            </div>
        </div>
    `);
    
    previewContainer.removeClass('hidden');
}

async function joinGroup() {
    try {
        const inviteCode = $('input[name="inviteCode"]').val().trim();
        if (!inviteCode) {
            showError('Ingresa un código o enlace de invitación');
            return;
        }
        
        const code = extractInviteCode(inviteCode);
        
        const response = await joinGroupAPI(code);
        
        if (response.success) {
            showSuccess('Te uniste al grupo');
            $('#modalJoinGroup').modal('hide');
            $('#joinGroupForm')[0].reset();
            $('#groupPreviewContainer').addClass('hidden');
            loadGroups(); // Refresh groups list
        } else {
            showError('No te uniste al grupo: ' + (response.error || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Error al unirte al grupo:', error);
        showError('Error al unirte al grupo');
    }
}

function extractInviteCode(input) {
    // Extract code from WhatsApp invite link or return as-is if it's just a code
    const match = input.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
    return match ? match[1] : input;
}

// API Functions
async function getGroups() {
    const token = getLocalStorageItem('token');
    const myHeaders = new Headers();
    myHeaders.append('token', token);
    myHeaders.append('Content-Type', 'application/json');
    
    const response = await fetch(baseUrl + "/group/list", {
        method: "GET",
        headers: myHeaders
    });
    
    return await response.json();
}

async function getGroupInfo(groupJID) {
    const token = getLocalStorageItem('token');
    const myHeaders = new Headers();
    myHeaders.append('token', token);
    myHeaders.append('Content-Type', 'application/json');
    
    const response = await fetch(baseUrl + "/group/info?" + new URLSearchParams({
        groupJID: groupJID
    }), {
        method: "GET",
        headers: myHeaders
    });
    
    return await response.json();
}

async function createGroupAPI(groupData) {
    const token = getLocalStorageItem('token');
    const myHeaders = new Headers();
    myHeaders.append('token', token);
    myHeaders.append('Content-Type', 'application/json');
    
    const response = await fetch(baseUrl + "/group/create", {
        method: "POST",
        headers: myHeaders,
        body: JSON.stringify(groupData)
    });
    
    return await response.json();
}

async function getGroupInviteInfo(code) {
    const token = getLocalStorageItem('token');
    const myHeaders = new Headers();
    myHeaders.append('token', token);
    myHeaders.append('Content-Type', 'application/json');
    
    const response = await fetch(baseUrl + "/group/inviteinfo", {
        method: "POST",
        headers: myHeaders,
        body: JSON.stringify({ code: code })
    });
    
    return await response.json();
}

async function joinGroupAPI(code) {
    const token = getLocalStorageItem('token');
    const myHeaders = new Headers();
    myHeaders.append('token', token);
    myHeaders.append('Content-Type', 'application/json');
    
    const response = await fetch(baseUrl + "/group/join", {
        method: "POST",
        headers: myHeaders,
        body: JSON.stringify({ code: code })
    });
    
    return await response.json();
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getCurrentUserJID() {
    // Try to get current user JID from various sources
    let userJID = window.currentUserJID;

    // If not found in window, try to get from localStorage using the helper function
    if (!userJID) {
        userJID = getLocalStorageItem('currentUserJID');
        
        // If found, also set it in window for future use
        if (userJID) {
            window.currentUserJID = userJID;
        }
    }
    
    // If still not found, try direct localStorage access as fallback
    if (!userJID) {
        try {
            const storedItem = localStorage.getItem('currentUserJID');
            if (storedItem) {
                // Try to parse as JSON first (expiry format)
                try {
                    const parsed = JSON.parse(storedItem);
                    if (parsed && parsed.value) {
                        userJID = parsed.value;
                    }
                } catch (e) {
                    // If JSON parsing fails, treat as plain string
                    userJID = storedItem;
                }
                
                // Set in window for future use
                if (userJID) {
                    window.currentUserJID = userJID;
                }
            }
        } catch (e) {
            console.log('Error accessing localStorage currentUserJID:', e);
        }
    }
    
    //console.log('Final userJID:', userJID);
    
    // Return empty string if still not found (this will make admin checks return false)
    return userJID || '';
}

// Helper function to extract phone number from JID
function extractPhoneFromJID(jid) {
    if (!jid) return '';
    
    // Extract the phone number part before the first ':' or '@'
    const phone = jid.split(':')[0].split('@')[0];
       
    return phone;
}

function checkIfUserIsAdmin(group, userJID) {
    // Return false if no participants data or no userJID
    if (!group.Participants || !userJID) {
        return false;
    }
    
    // Extract phone number from current user JID
    const currentUserPhone = extractPhoneFromJID(userJID);
    if (!currentUserPhone) return false;
    
    // Find the current user in the participants list by comparing phone numbers
    const participant = group.Participants.find(p => {
        const participantPhone = extractPhoneFromJID(p.JID);
        return participantPhone === currentUserPhone;
    });
    
    // Return true if user is found and is either admin or super admin
    return participant ? (participant.IsAdmin || participant.IsSuperAdmin) : false;
}

function checkIfUserIsSuperAdmin(group, userJID) {
    // Return false if no participants data or no userJID
    if (!group.Participants || !userJID) {
        return false;
    }
    
    // Extract phone number from current user JID
    const currentUserPhone = extractPhoneFromJID(userJID);
    if (!currentUserPhone) return false;
    
    // Find the current user in the participants list by comparing phone numbers
    const participant = group.Participants.find(p => {
        const participantPhone = extractPhoneFromJID(p.JID);
        return participantPhone === currentUserPhone;
    });
    
    // Return true only if user is found and is specifically a super admin
    return participant ? participant.IsSuperAdmin : false;
}

function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function toggleDescription(element) {
    const descriptionDiv = element.parentElement;
    const fullText = descriptionDiv.getAttribute('data-full-text');
    
    if (element.textContent.trim() === 'Leer más') {
        descriptionDiv.innerHTML = escapeHtml(fullText) + ' <a href="#" class="read-more-link" onclick="toggleDescription(this)">Leer menos</a>';
    } else {
        const truncated = truncateText(fullText, 100);
        descriptionDiv.innerHTML = escapeHtml(truncated) + ' <a href="#" class="read-more-link" onclick="toggleDescription(this)">Leer más</a>';
    }
}

function openGroupChat(groupJID) {
    // This would open the chat interface for the group
    // Implementation depends on your chat interface
    //console.log('Opening chat for group:', groupJID);
    showSuccess('Aquí se abriría el chat');
}

function manageGroup(groupJID) {
    viewGroupDetails(groupJID);
}

// Additional functions for group management will be added in subsequent tasks
// This includes: edit group, manage participants, group settings, etc.

// Enhanced function to get user info and set userJID
async function getUserInfoAndSetJID() {
    try {
        // Try to get user info from status API to get the JID
        const token = getLocalStorageItem('token');
        const myHeaders = new Headers();
        myHeaders.append('token', token);
        myHeaders.append('Content-Type', 'application/json');
        
        const response = await fetch(baseUrl + "/session/status", {
            method: "GET",
            headers: myHeaders
        });
        
        const data = await response.json();
        if (data.code === 200 && data.data && data.data.jid) {
            const userJID = data.data.jid;
            localStorage.setItem('currentUserJID', userJID);
            window.currentUserJID = userJID;
            //console.log('User JID set from status:', userJID);
            return userJID;
        }
    } catch (error) {
        console.log('Could not get user status:', error);
    }
    
    return null;
}

// Group management functions
function showEditGroupInfoModal() {
    if (!currentGroupId) return;
    
    // Get current group data
    const groupData = groupsCache.Groups ? groupsCache.Groups.find(g => g.JID === currentGroupId) : null;
    if (groupData) {
        $('#editGroupNameInput').val(groupData.Name || '');
        $('#editGroupDescriptionInput').val(groupData.Topic || '');
    }
    
    $('#modalEditGroupInfo').modal('show');
}

function showGroupSettingsModal() {
    if (!currentGroupId) return;
    
    // Get current group data
    const groupData = groupsCache.Groups ? groupsCache.Groups.find(g => g.JID === currentGroupId) : null;
    if (groupData) {
        // Set current settings
        $('#announceOnlyToggle').checkbox(groupData.IsAnnounce ? 'check' : 'uncheck');
        $('#editInfoToggle').checkbox(groupData.IsLocked ? 'check' : 'uncheck');
        
        // Set disappearing timer
        let timerValue = 'off';
        if (groupData.IsEphemeral && groupData.DisappearingTimer) {
            switch (groupData.DisappearingTimer) {
                case 86400: timerValue = '24h'; break;
                case 604800: timerValue = '7d'; break;
                case 7776000: timerValue = '90d'; break;
            }
        }
        $('#disappearingTimerSelect').dropdown('set selected', timerValue);
    }
    
    $('#modalGroupSettings').modal('show');
}

function showGroupInviteLinkModal() {
    if (!currentGroupId) return;
    
    $('#currentInviteLink').val('Loading...');
    $('#modalGroupInviteLink').modal('show');
    
    // Load current invite link
    getGroupInviteLink(currentGroupId).then(response => {
        if (response.success && response.data && response.data.InviteLink) {
            $('#currentInviteLink').val(response.data.InviteLink);
        } else {
            $('#currentInviteLink').val('No se cargó el enlace de invitación');
        }
    }).catch(error => {
        console.error('Error loading invite link:', error);
        $('#currentInviteLink').val('Error loading invite link');
    });
}

function showManageParticipantsModal() {
    if (!currentGroupId) return;
    
    // Clear previous data
    $('#addParticipantsDropdown').dropdown('clear');
    $('#participantsContactsStatus').hide();
    
    // Populate current participants
    populateCurrentParticipantsList();
    
    $('#modalManageParticipants').modal('show');
}

function populateCurrentParticipantsList() {
    const participantsList = $('#manageParticipantsList');
    participantsList.empty();
    
    const groupData = groupsCache.Groups ? groupsCache.Groups.find(g => g.JID === currentGroupId) : null;
    if (groupData && groupData.Participants) {
        const currentUserJID = getCurrentUserJID();
        const currentUserIsSuperAdmin = checkIfUserIsSuperAdmin(groupData, currentUserJID);
        const currentUserIsAdmin = checkIfUserIsAdmin(groupData, currentUserJID);
        
        groupData.Participants.forEach(participant => {
            const phone = participant.JID ? participant.JID.split('@')[0] : 'Unknown';
            const participantIsAdmin = participant.IsAdmin || false;
            const participantIsSuperAdmin = participant.IsSuperAdmin || false;
            const currentUserPhone = extractPhoneFromJID(currentUserJID);
            const participantPhone = extractPhoneFromJID(participant.JID);
            const isCurrentUser = currentUserPhone && participantPhone && currentUserPhone === participantPhone;
            
            let actionButtons = '';
            
            // Show action buttons only if current user is admin/super admin and target is not current user
            if (!isCurrentUser && (currentUserIsAdmin || currentUserIsSuperAdmin)) {
                const buttons = [];
                
                // Remove button - available for admins
                buttons.push(`
                    <button class="box-btn box-btn-danger box-btn-sm" onclick="removeParticipant('${participant.JID}')" title="Quitar del grupo">
                        <i class="fas fa-minus"></i> Remove
                    </button>
                `);
                
                // Promote/Demote buttons - based on current user permissions
                if (currentUserIsSuperAdmin) {
                    // Super admins can promote/demote anyone
                    if (!participantIsAdmin && !participantIsSuperAdmin) {
                        // Hacer administrador
                        buttons.push(`
                            <button class="box-btn box-btn-sm" onclick="promoteParticipant('${participant.JID}')" title="Hacer administrador">
                                <i class="fas fa-star"></i> Promote
                            </button>
                        `);
                    } else if (participantIsAdmin && !participantIsSuperAdmin) {
                        // Quitar como administrador
                        buttons.push(`
                            <button class="box-btn secondary box-btn-sm" onclick="demoteParticipant('${participant.JID}')" title="Quitar como administrador">
                                <i class="far fa-star"></i> Demote
                            </button>
                        `);
                    }
                } else if (currentUserIsAdmin && !participantIsAdmin && !participantIsSuperAdmin) {
                    // Regular admins can only promote regular users to admin
                    buttons.push(`
                        <button class="box-btn box-btn-sm" onclick="promoteParticipant('${participant.JID}')" title="Hacer administrador">
                            <i class="fas fa-star"></i> Promote
                        </button>
                    `);
                }
                
                if (buttons.length > 0) {
                    actionButtons = `
                        <div class="">
                            ${buttons.join('')}
                        </div>
                    `;
                }
            }
            
            const participantItem = `
                <div class="item participant-item">
                    <div class="content">
                        <div class="participant-info">
                            <div class="header">${escapeHtml(participant.DisplayName || phone)}</div>
                            <div class="description">+${phone}</div>
                        </div>
                        <div class="participant-actions">
                            <div class="participant-labels">
                                ${participantIsSuperAdmin ? '<span class="box-badge box-badge-danger"><i class="fas fa-shield"></i>Superadministrador</span>' : 
                                  participantIsAdmin ? '<span class="box-badge box-badge-warning"><i class="fas fa-star"></i>Administrador</span>' : ''}
                                ${isCurrentUser ? '<span class="box-badge box-badge-primary">You</span>' : ''}
                            </div>
                            ${actionButtons}
                        </div>
                    </div>
                </div>
            `;
            participantsList.append(participantItem);
        });
    }
}

function populateAddParticipantsDropdown() {
    const dropdown = $('#addParticipantsDropdown .menu');
    dropdown.empty();
    
    if (contactsCache && typeof contactsCache === 'object' && Object.keys(contactsCache).length > 0) {
        // Get current participants to exclude them
        const groupData = groupsCache.Groups ? groupsCache.Groups.find(g => g.JID === currentGroupId) : null;
        const currentParticipants = groupData && groupData.Participants ? 
            groupData.Participants.map(p => p.JID.split('@')[0]) : [];
        
        Object.entries(contactsCache).forEach(([jid, contact]) => {
            const phone = contact.Phone;
            const name = contact.FullName || contact.PushName || phone;
            
            // Don't show contacts that are already participants
            if (!currentParticipants.includes(phone)) {
                dropdown.append(`<div class="item" data-value="${phone}">${escapeHtml(name)} (+${phone})</div>`);
            }
        });
        
        $('#addParticipantsDropdown .default.text').text('Selecciona contactos para agregar');
    } else {
        dropdown.append('<div class="item disabled">No hay contactos cargados. Pulsa "Cargar contactos" para llenar la lista.</div>');
        $('#addParticipantsDropdown .default.text').text('Carga primero los contactos');
    }
    
    $('#addParticipantsDropdown').dropdown('refresh');
}

// Action functions
async function saveGroupInfo() {
    if (!currentGroupId) return;
    
    const groupName = $('#editGroupNameInput').val().trim();
    const groupDescription = $('#editGroupDescriptionInput').val().trim();
    
    if (!groupName) {
        showError('El nombre del grupo es obligatorio');
        return;
    }
    
    try {
        // Update group name
        const nameResponse = await updateGroupName(currentGroupId, groupName);
        if (!nameResponse.success) {
            throw new Error('No se actualizó el nombre del grupo: ' + (nameResponse.error || 'Error desconocido'));
        }
        
        // Update group description if provided
        if (groupDescription) {
            const topicResponse = await updateGroupTopic(currentGroupId, groupDescription);
            if (!topicResponse.success) {
                throw new Error('No se actualizó la descripción del grupo: ' + (topicResponse.error || 'Error desconocido'));
            }
        }
        
        showSuccess('Información del grupo actualizada');
        $('#modalEditGroupInfo').modal('hide');
        
        // Refresh group details
        setTimeout(() => {
            viewGroupDetails(currentGroupId);
        }, 1000);
        
    } catch (error) {
        console.error('Error updating group info:', error);
        showError('Error al actualizar la información del grupo: ' + error.message);
    }
}

async function saveGroupSettings() {
    if (!currentGroupId) return;
    
    try {
        const announceOnly = $('#announceOnlyToggle').checkbox('is checked');
        const locked = $('#editInfoToggle').checkbox('is checked');
        const disappearingTimer = $('#disappearingTimerSelect').dropdown('get value');
        
        // Update announce setting
        const announceResponse = await updateGroupAnnounce(currentGroupId, announceOnly);
        if (!announceResponse.success) {
            throw new Error('No se actualizó el ajuste de solo administradores');
        }
        
        // Update locked setting
        const lockedResponse = await updateGroupLocked(currentGroupId, locked);
        if (!lockedResponse.success) {
            throw new Error('No se actualizó el ajuste de edición');
        }
        
        // Update disappearing timer
        const ephemeralResponse = await updateGroupEphemeral(currentGroupId, disappearingTimer);
        if (!ephemeralResponse.success) {
            throw new Error('No se actualizó el temporizador de mensajes');
        }
        
        showSuccess('Ajustes del grupo actualizados');
        $('#modalGroupSettings').modal('hide');
        
        // Refresh group details
        setTimeout(() => {
            viewGroupDetails(currentGroupId);
        }, 1000);
        
    } catch (error) {
        console.error('Error updating group settings:', error);
        showError('Error al actualizar los ajustes del grupo: ' + error.message);
    }
}

async function addParticipants() {
    if (!currentGroupId) return;
    
    const selectedParticipants = $('#addParticipantsDropdown').dropdown('get value');
    if (!selectedParticipants || selectedParticipants.length === 0) {
        showError('Selecciona participantes para agregar');
        return;
    }
    
    try {
        // Convert phone numbers - API expects just phone numbers, not JIDs
        const participantNumbers = Array.isArray(selectedParticipants) ? 
            selectedParticipants : [selectedParticipants];
        
        const response = await updateGroupParticipants(currentGroupId, 'add', participantNumbers);
        
        if (response.success) {
            showSuccess('Participantes agregados');
            $('#addParticipantsDropdown').dropdown('clear');
            
            // Refresh participants list
            populateCurrentParticipantsList();
            populateAddParticipantsDropdown();
            
            // Refresh group details
            setTimeout(() => {
                viewGroupDetails(currentGroupId);
            }, 1000);
        } else {
            throw new Error(response.error || 'Error desconocido');
        }
        
    } catch (error) {
        console.error('Error adding participants:', error);
        showError('Error al agregar participantes: ' + error.message);
    }
}

async function removeParticipant(participantJID) {
    if (!currentGroupId || !participantJID) return;
    
    if (!confirm('¿Seguro que quieres quitar a este participante del grupo?')) {
        return;
    }
    
    try {
        // Extract phone number from JID (remove @s.whatsapp.net part)
        const phoneNumber = participantJID.split('@')[0];
        
        const response = await updateGroupParticipants(currentGroupId, 'remove', [phoneNumber]);
        
        if (response.success) {
            showSuccess('Participante quitado');
            
            // Refresh participants list
            populateCurrentParticipantsList();
            populateAddParticipantsDropdown();
            
            // Refresh group details
            setTimeout(() => {
                viewGroupDetails(currentGroupId);
            }, 1000);
        } else {
            throw new Error(response.error || 'Error desconocido');
        }
        
    } catch (error) {
        console.error('Error removing participant:', error);
        showError('Error al quitar al participante: ' + error.message);
    }
}

async function promoteParticipant(participantJID) {
    if (!currentGroupId || !participantJID) return;
    
    if (!confirm('¿Seguro que quieres hacer administrador a este participante?')) {
        return;
    }
    
    try {
        // Extract phone number from JID (remove @s.whatsapp.net part)
        const phoneNumber = participantJID.split('@')[0];
        
        const response = await updateGroupParticipants(currentGroupId, 'promote', [phoneNumber]);
        
        if (response.success) {
            showSuccess('Participante ahora es administrador');
            
            // Refresh participants list
            populateCurrentParticipantsList();
            
            // Refresh group details
            setTimeout(() => {
                viewGroupDetails(currentGroupId);
            }, 1000);
        } else {
            throw new Error(response.error || 'Error desconocido');
        }
        
    } catch (error) {
        console.error('Error promoting participant:', error);
        showError('Error al hacer administrador al participante: ' + error.message);
    }
}

async function demoteParticipant(participantJID) {
    if (!currentGroupId || !participantJID) return;
    
    if (!confirm('¿Seguro que quieres quitar a este administrador y dejarlo como participante?')) {
        return;
    }
    
    try {
        // Extract phone number from JID (remove @s.whatsapp.net part)
        const phoneNumber = participantJID.split('@')[0];
        
        const response = await updateGroupParticipants(currentGroupId, 'demote', [phoneNumber]);
        
        if (response.success) {
            showSuccess('El administrador pasó a ser participante');
            
            // Refresh participants list
            populateCurrentParticipantsList();
            
            // Refresh group details
            setTimeout(() => {
                viewGroupDetails(currentGroupId);
            }, 1000);
        } else {
            throw new Error(response.error || 'Error desconocido');
        }
        
    } catch (error) {
        console.error('Error demoting participant:', error);
        showError('Error al quitar como administrador: ' + error.message);
    }
}

async function copyInviteLink() {
    const inviteLink = $('#currentInviteLink').val();
    if (!inviteLink || inviteLink === 'Loading...' || inviteLink.includes('No se cargó') || inviteLink.includes('Error')) {
        showError('No hay un enlace de invitación válido para copiar');
        return;
    }
    
    try {
        await navigator.clipboard.writeText(inviteLink);
        showSuccess('Enlace de invitación copiado');
    } catch (error) {
        console.error('Error copying to clipboard:', error);
        showError('No se pudo copiar el enlace de invitación');
    }
}

async function resetInviteLink() {
    if (!currentGroupId) return;
    
    if (!confirm('¿Seguro que quieres restablecer el enlace? El enlace actual dejará de funcionar.')) {
        return;
    }
    
    try {
        $('#currentInviteLink').val('Resetting...');
        
        const response = await getGroupInviteLink(currentGroupId, true); // true = reset
        
        if (response.success && response.data && response.data.InviteLink) {
            $('#currentInviteLink').val(response.data.InviteLink);
            showSuccess('Enlace de invitación restablecido');
        } else {
            throw new Error(response.error || 'Error desconocido');
        }
        
    } catch (error) {
        console.error('Error resetting invite link:', error);
        $('#currentInviteLink').val('Error resetting invite link');
        showError('Error al restablecer el enlace: ' + error.message);
    }
}

async function removeGroupPhoto() {
    if (!currentGroupId) return;
    
    if (!confirm('¿Seguro que quieres quitar la foto del grupo?')) {
        return;
    }
    
    try {
        const response = await removeGroupPhotoAPI(currentGroupId);
        
        if (response.success) {
            showSuccess('Foto del grupo quitada');
            
            // Refresh group details
            setTimeout(() => {
                viewGroupDetails(currentGroupId);
            }, 1000);
        } else {
            throw new Error(response.error || 'Error desconocido');
        }
        
    } catch (error) {
        console.error('Error removing group photo:', error);
        showError('Error al quitar la foto del grupo: ' + error.message);
    }
}

async function uploadGroupPhoto(file) {
    if (!currentGroupId || !file) {
        showError('No se eligió un grupo o un archivo');
        return;
    }
    
    // Validate file type
    const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!file.type.startsWith('image/') || !supportedTypes.includes(file.type.toLowerCase())) {
        showError('Elige una imagen compatible (JPEG, PNG, GIF, WebP)');
        return;
    }
    
    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        showError('La imagen es demasiado grande. Elige una de menos de 10 MB.');
        return;
    }
    
    let uploadButton = null;
    
    try {
        // Show loading state
        uploadButton = document.querySelector('#changeGroupPhotoBtn');
        if (uploadButton) {
            uploadButton.disabled = true;
            uploadButton.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Procesando…';
        }
        
        console.log('Starting group photo upload process...');
        console.log('File details:', {
            name: file.name,
            type: file.type,
            size: file.size,
            lastModified: file.lastModified
        });
        
        // Convert file to base64 (preserves format when possible)
        console.log('Converting image to optimized format...');
        const processedImage = await fileToBase64(file);
        
        if (!processedImage) {
            throw new Error('No se pudo procesar la imagen');
        }
        
        console.log('Image processed successfully, uploading to server...');
        console.log('Processed image stats:', {
            base64Length: processedImage.base64.length,
            format: processedImage.format,
            estimatedSizeKB: Math.round(processedImage.base64.length * 0.75 / 1024),
            firstChars: processedImage.base64.substring(0, 20),
            lastChars: processedImage.base64.substring(processedImage.base64.length - 20)
        });
        
        // Update button text
        if (uploadButton) {
            uploadButton.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Subiendo…';
        }
        
        const response = await updateGroupPhoto(currentGroupId, processedImage.base64);
        
        if (response.success) {
            showSuccess('Foto del grupo actualizada');
            console.log('Group photo upload completed successfully');
            
            // Refresh group details after a short delay
            setTimeout(() => {
                viewGroupDetails(currentGroupId);
            }, 1500);
        } else {
            const errorMsg = response.error || 'No se actualizó la foto del grupo';
            console.error('Server error:', errorMsg);
            
            // If the error suggests a format issue, provide helpful feedback
            if (errorMsg.includes('decode') || errorMsg.includes('base64')) {
                throw new Error('Error de codificación de la imagen. Prueba con otra imagen.');
            } else if (errorMsg.includes('format') || errorMsg.includes('data:image')) {
                throw new Error('Error de formato de imagen. Asegúrate de que sea JPEG, PNG, GIF o WebP.');
            } else if (errorMsg.includes('Internal server error')) {
                throw new Error('Ocurrió un error en el servidor. Inténtalo de nuevo o contacta a soporte si persiste.');
            } else {
                throw new Error(errorMsg);
            }
        }
        
    } catch (error) {
        console.error('Error al subir la foto del grupo:', error);
        
        // Provide more specific error messages
        let errorMessage = 'Error al subir la foto del grupo';
        if (error.message.includes('Error de red')) {
            errorMessage = 'Error de red. Revisa tu conexión e inténtalo de nuevo.';
        } else if (error.message.includes('Formato de imagen inválido')) {
            errorMessage = 'Formato de imagen inválido. Prueba con otra imagen.';
        } else if (error.message.includes('No se pudo procesar')) {
            errorMessage = 'No se pudo procesar la imagen. Prueba con otro archivo.';
        } else if (error.message) {
            errorMessage += ': ' + error.message;
        }
        
        showError(errorMessage);
        
    } finally {
        // Reset button state
        if (uploadButton) {
            uploadButton.disabled = false;
            uploadButton.innerHTML = '<i class="fas fa-upload"></i> Cambiar foto';
        }
    }
}

function confirmLeaveGroup() {
    if (!currentGroupId) return;
    
    if (!confirm('¿Seguro que quieres salir de este grupo? Esta acción no se puede deshacer.')) {
        return;
    }
    
    leaveGroup();
}

async function leaveGroup() {
    if (!currentGroupId) return;
    
    try {
        const response = await leaveGroupAPI(currentGroupId);
        
        if (response.success) {
            showSuccess('Saliste del grupo');
            $('#modalGroupDetails').modal('hide');
            
            // Refresh groups list
            setTimeout(() => {
                loadGroups();
            }, 1000);
        } else {
            throw new Error(response.error || 'Error desconocido');
        }
        
    } catch (error) {
        console.error('Error leaving group:', error);
        showError('Error al salir del grupo: ' + error.message);
    }
}

// Test function to create a minimal valid JPEG for testing
function createTestJPEG() {
    // Create a minimal 1x1 pixel JPEG image
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    
    // Fill with white
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 1, 1);
    
    // Convert to JPEG
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    return dataUrl.split(',')[1]; // Return just the base64 part
}

// Utility function to convert file to base64 (preserves original format when possible, converts to JPEG for compatibility)
function fileToBase64(file) {
    return new Promise((resolve, reject) => {

        // Create a canvas to convert any image format to JPEG
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = function() {
            try {

                // Calculate new dimensions (max 640x640 for better quality while keeping size reasonable)
                const maxSize = 640;
                let { width, height } = img;
                
                // Ensure minimum size for very small images
                const minSize = 64;
                if (width < minSize && height < minSize) {
                    const scale = minSize / Math.max(width, height);
                    width *= scale;
                    height *= scale;
                }
                
                if (width > maxSize || height > maxSize) {
                    if (width > height) {
                        height = (height * maxSize) / width;
                        width = maxSize;
                    } else {
                        width = (width * maxSize) / height;
                        height = maxSize;
                    }
                }
                
                // Set canvas dimensions to calculated dimensions
                canvas.width = Math.round(width);
                canvas.height = Math.round(height);
                
                // WhatsApp only accepts JPEG format for group photos
                // Always convert to JPEG with white background
                const outputFormat = 'image/jpeg';
                const quality = 0.8;
                
                // Fill with white background (required for JPEG, removes transparency)
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw image on canvas with new dimensions
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // Convert to appropriate format
                const dataUrl = canvas.toDataURL(outputFormat, quality);
                
                // Validate the data URL
                if (!dataUrl || !dataUrl.startsWith(`data:${outputFormat};base64,`)) {
                    throw new Error(`Failed to convert image to ${outputFormat} format`);
                }
                
                // Extract just the base64 part
                const base64 = dataUrl.split(',')[1];
                
                // Validate base64 string
                if (!base64 || base64.length === 0) {
                    throw new Error('Generated base64 string is empty');
                }
                
                // Final validation - ensure it's a valid base64 string
                try {
                    const decodedData = atob(base64);
                    
                    // Additional validation - check minimum size
                    if (decodedData.length < 10) {
                        throw new Error('Generated image data is too small');
                    }
                    
                    // Format-specific validation
                    if (outputFormat === 'image/jpeg') {
                        // Check JPEG magic bytes (FF D8 FF)
                        const firstBytes = decodedData.substring(0, 3);
                        const magicBytes = String.fromCharCode(0xFF, 0xD8, 0xFF);
                        if (firstBytes !== magicBytes) {
                            //console.warn('Warning: Generated data may not be a valid JPEG');
                        }
                    } else if (outputFormat === 'image/png') {
                        // Check PNG magic bytes (89 50 4E 47)
                        const firstBytes = decodedData.substring(0, 4);
                        const magicBytes = String.fromCharCode(0x89, 0x50, 0x4E, 0x47);
                        if (firstBytes !== magicBytes) {
                            //console.warn('Warning: Generated data may not be a valid PNG');
                        }
                    }
                    
                } catch (e) {
                    console.error('Base64 validation failed:', e);
                    throw new Error('Generated base64 string is invalid: ' + e.message);
                }
                
                resolve({
                    base64: base64,
                    format: outputFormat,
                    dataUrl: dataUrl
                });
                
            } catch (error) {
                console.error('Error processing image:', error);
                reject(error);
            }
        };
        
        img.onerror = function(error) {
            console.error('Failed to load image:', error);
            reject(new Error('No se pudo cargar la imagen. Asegúrate de que sea válida.'));
        };
        
        // Create object URL from file and load into image
        try {
            const objectUrl = URL.createObjectURL(file);
            
            // Set up cleanup
            const cleanup = () => {
                URL.revokeObjectURL(objectUrl);
            };
            
            // Store original handlers
            const originalOnload = img.onload;
            const originalOnerror = img.onerror;
            
            // Override handlers to include cleanup
            img.onload = function() {
                cleanup();
                originalOnload.call(this);
            };
            
            img.onerror = function(error) {
                cleanup();
                originalOnerror.call(this, error);
            };
            
            img.src = objectUrl;
            
        } catch (error) {
            console.error('Error creating object URL:', error);
            reject(new Error('No se pudo procesar la imagen'));
        }
    });
}

// API Functions for Group Management
async function updateGroupName(groupJID, name) {
    const token = getLocalStorageItem('token');
    const myHeaders = new Headers();
    myHeaders.append('token', token);
    myHeaders.append('Content-Type', 'application/json');
    
    const response = await fetch(baseUrl + "/group/name", {
        method: "POST",
        headers: myHeaders,
        body: JSON.stringify({
            GroupJID: groupJID,
            Name: name
        })
    });
    
    const data = await response.json();
    return {
        success: data.code === 200,
        data: data.data,
        error: data.error || data.message
    };
}

async function updateGroupTopic(groupJID, topic) {
    const token = getLocalStorageItem('token');
    const myHeaders = new Headers();
    myHeaders.append('token', token);
    myHeaders.append('Content-Type', 'application/json');
    
    const response = await fetch(baseUrl + "/group/topic", {
        method: "POST",
        headers: myHeaders,
        body: JSON.stringify({
            GroupJID: groupJID,
            Topic: topic
        })
    });
    
    const data = await response.json();
    return {
        success: data.code === 200,
        data: data.data,
        error: data.error || data.message
    };
}

async function updateGroupAnnounce(groupJID, announce) {
    const token = getLocalStorageItem('token');
    const myHeaders = new Headers();
    myHeaders.append('token', token);
    myHeaders.append('Content-Type', 'application/json');
    
    const response = await fetch(baseUrl + "/group/announce", {
        method: "POST",
        headers: myHeaders,
        body: JSON.stringify({
            GroupJID: groupJID,
            Announce: announce
        })
    });
    
    const data = await response.json();
    return {
        success: data.code === 200,
        data: data.data,
        error: data.error || data.message
    };
}

async function updateGroupLocked(groupjid, locked) {
    const token = getLocalStorageItem('token');
    const myHeaders = new Headers();
    myHeaders.append('token', token);
    myHeaders.append('Content-Type', 'application/json');
    
    const response = await fetch(baseUrl + "/group/locked", {
        method: "POST",
        headers: myHeaders,
        body: JSON.stringify({
            GroupJID: groupjid,
            Locked: locked
        })
    });
    
    const data = await response.json();
    return {
        success: data.code === 200,
        data: data.data,
        error: data.error || data.message
    };
}

async function updateGroupEphemeral(groupjid, duration) {
    const token = getLocalStorageItem('token');
    const myHeaders = new Headers();
    myHeaders.append('token', token);
    myHeaders.append('Content-Type', 'application/json');
    
    const response = await fetch(baseUrl + "/group/ephemeral", {
        method: "POST",
        headers: myHeaders,
        body: JSON.stringify({
            GroupJID: groupjid,
            Duration: duration
        })
    });
    
    const data = await response.json();
    return {
        success: data.code === 200,
        data: data.data,
        error: data.error || data.message
    };
}

async function updateGroupParticipants(groupJID, action, participants) {
    const token = getLocalStorageItem('token');
    const myHeaders = new Headers();
    myHeaders.append('token', token);
    myHeaders.append('Content-Type', 'application/json');
    
    const response = await fetch(baseUrl + "/group/updateparticipants", {
        method: "POST",
        headers: myHeaders,
        body: JSON.stringify({
            GroupJID: groupJID,
            Action: action,
            Phone: participants
        })
    });
    
    const data = await response.json();
    return {
        success: data.code === 200,
        data: data.data,
        error: data.error || data.message
    };
}

async function getGroupInviteLink(groupJID, reset = false) {
    const token = getLocalStorageItem('token');
    const myHeaders = new Headers();
    myHeaders.append('token', token);
    myHeaders.append('Content-Type', 'application/json');
    
    const params = new URLSearchParams({
        groupJID: groupJID
    });
    
    if (reset) {
        params.append('reset', 'true');
    }
    
    const response = await fetch(baseUrl + "/group/invitelink?" + params.toString(), {
        method: "GET",
        headers: myHeaders
    });
    
    const data = await response.json();
    return {
        success: data.code === 200,
        data: data.data,
        error: data.error || data.message
    };
}

async function updateGroupPhoto(groupJID, photoBase64) {
    const token = getLocalStorageItem('token');
    const myHeaders = new Headers();
    myHeaders.append('token', token);
    myHeaders.append('Content-Type', 'application/json');
    
    // Ensure the image data is properly formatted for the backend
    // WhatsApp only accepts JPEG format for group photos
    const imageData = `data:image/jpeg;base64,${photoBase64}`;

    // Validate the image data format before sending
    if (!imageData.startsWith('data:image/')) {
        throw new Error('Formato de imagen inválido. Se esperaba una URL de datos.');
    }
    
    // Ensure the payload matches exactly what the backend expects
    const payload = {
        GroupJID: groupJID,
        Image: imageData
    };
        
    try {
        const response = await fetch(baseUrl + "/group/photo", {
            method: "POST",
            headers: myHeaders,
            body: JSON.stringify(payload)
        });

        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error(`Server returned non-JSON response (${response.status}): ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Handle different response formats
        if (response.status === 200 && data.code === 200) {
            return {
                success: true,
                data: data.data,
                error: null
            };
        } else {
            // Handle error responses - provide detailed error information
            let errorMessage = 'Error desconocido del servidor';
            
            if (data.error) {
                errorMessage = data.error;
            } else if (data.message) {
                errorMessage = data.message;
            } else if (response.status === 500) {
                errorMessage = 'Error interno del servidor. Revisa los registros del servidor.';
            } else if (response.status === 400) {
                errorMessage = 'Solicitud inválida. Revisa el formato de la imagen e inténtalo de nuevo.';
            } else {
                errorMessage = `Server error (${response.status}): ${response.statusText}`;
            }
            
            console.error('Server error details:', {
                status: response.status,
                statusText: response.statusText,
                data: data,
                errorMessage: errorMessage
            });
            
            return {
                success: false,
                data: null,
                error: errorMessage
            };
        }
        
    } catch (error) {
        console.error('Network or parsing error:', error);
        return {
            success: false,
            data: null,
            error: `Error de red: ${error.message}`
        };
    }
}

async function removeGroupPhotoAPI(groupjid) {
    const token = getLocalStorageItem('token');
    const myHeaders = new Headers();
    myHeaders.append('token', token);
    myHeaders.append('Content-Type', 'application/json');
    
    const response = await fetch(baseUrl + "/group/photo/remove", {
        method: "POST",
        headers: myHeaders,
        body: JSON.stringify({
            GroupJID: groupjid
        })
    });
    
    const data = await response.json();
    return {
        success: data.code === 200,
        data: data.data,
        error: data.error || data.message
    };
}

async function leaveGroupAPI(groupJID) {
    const token = getLocalStorageItem('token');
    const myHeaders = new Headers();
    myHeaders.append('token', token);
    myHeaders.append('Content-Type', 'application/json');
    
    const response = await fetch(baseUrl + "/group/leave", {
        method: "POST",
        headers: myHeaders,
        body: JSON.stringify({
            GroupJID: groupJID
        })
    });
    
    const data = await response.json();
    return {
        success: data.code === 200,
        data: data.data,
        error: data.error || data.message
    };
} 