let baseUrl = window.location.origin;
let scanned = false;
let updateAdminTimeout = null;
let updateUserTimeout = null;
let updateInterval = 5000;
let deletionInProgress = false;
let isAdminLogin = false;
let currentInstanceData = null;

document.addEventListener('DOMContentLoaded', function() {

  let isHandlingChange = false;

  const loginForm = document.getElementById('loginForm');
  const loginTokenInput = document.getElementById('loginToken');
  const regularLoginBtn = document.getElementById('regularLoginBtn');
  const adminLoginBtn = document.getElementById('loginAsAdminBtn');
 
  hideWidgets();

  // Initialize dropdowns for webhook events
  $('#webhookEvents').dropdown({
    onChange: function(value, text, $selectedItem) {
      if (isHandlingChange) return;
      if (value.includes('All')) {
        // If "All" is selected, clear selection and select only "All"
        isHandlingChange = true;
        $('#webhookEvents').dropdown('clear');
        $('#webhookEvents').dropdown('set selected', 'All');
        isHandlingChange = false;
      }
    }
  });

  $('#webhookEventsInstance').dropdown({
    onChange: function(value, text, $selectedItem) {
      if (isHandlingChange) return;
      if (value.includes('All')) {
        // If "All" is selected, clear selection and select only "All"
        isHandlingChange = true;
        $('#webhookEventsInstance').dropdown('clear');
        $('#webhookEventsInstance').dropdown('set selected', 'All');
        isHandlingChange = false;
      }
    }
  });

  // Initialize S3 media delivery dropdown
  $('#s3MediaDelivery').dropdown();
  $('#addInstanceS3MediaDelivery').dropdown();

  // Initialize proxy enabled checkbox with onChange handler
  $('#proxyEnabledToggle').checkbox({
    onChange: function() {
      const enabled = $('#proxyEnabled').is(':checked');
      if (enabled) {
        $('#proxyUrlField').addClass('show');
        $('#proxyWebhookUseProxyField').addClass('show');
      } else {
        $('#proxyUrlField').removeClass('show');
        $('#proxyWebhookUseProxyField').removeClass('show');
      }
    }
  });
  $('#proxyWebhookUseProxyToggle').checkbox();

  // Initialize add instance proxy toggle
  $('#addInstanceProxyToggle').checkbox({
    onChange: function() {
      const enabled = $('input[name="proxy_enabled"]').is(':checked');
      if (enabled) {
        $('#addInstanceProxyUrlField').show();
        $('#addInstanceProxyWebhookUseProxyField').show();
      } else {
        $('#addInstanceProxyUrlField').hide();
        $('#addInstanceProxyWebhookUseProxyField').hide();
        $('input[name="proxy_url"]').val('');
      }
    }
  });
  $('#addInstanceProxyWebhookUseProxyToggle').checkbox();

  // Initialize add instance S3 toggle
  $('#addInstanceS3Toggle').checkbox({
    onChange: function() {
      const enabled = $('input[name="s3_enabled"]').is(':checked');
      if (enabled) {
        $('#addInstanceS3Fields').show();
      } else {
        $('#addInstanceS3Fields').hide();
        // Clear S3 fields when disabled
        $('input[name="s3_endpoint"]').val('');
        $('input[name="s3_access_key"]').val('');
        $('input[name="s3_secret_key"]').val('');
        $('input[name="s3_bucket"]').val('');
        $('input[name="s3_region"]').val('');
        $('input[name="s3_public_url"]').val('');
        $('input[name="s3_retention_days"]').val('30');
        $('input[name="s3_path_style"]').prop('checked', false);
        $('#addInstanceS3MediaDelivery').dropdown('set selected', 'base64');
      }
    }
  });

  // Initialize add instance HMAC toggle
  $('#addInstanceHmacToggle').checkbox({
    onChange: function() {
      const enabled = $('input[name="hmac_enabled"]').is(':checked');
      if (enabled) {
        $('#addInstanceHmacKeyWarningMessage').show();
        $('#addInstanceHmacKeyField').show();
      } else {
        $('#addInstanceHmacKeyWarningMessage').hide();
        $('#addInstanceHmacKeyField').hide();
        // Clear HMAC field when disabled
        $('input[name="hmac_key"]').val('');
      }
    }
  });

  // Handle admin login button click
  adminLoginBtn.addEventListener('click', function() {
    isAdminLogin = true;
    loginForm.classList.add('loading');
    
    // Change button appearance to show admin mode
    adminLoginBtn.classList.add('teal');
    adminLoginBtn.innerHTML = '<i class="fas fa-shield-halved"></i> Modo administrador';
    $('#loginToken').val('').focus();
    
    // Show admin-specific instructions
    $('.logingrid .box-alert').html(`
        <div class="header mb-4">
            <i class="fas fa-user-shield"></i>
            Acceso de administrador
        </div>
        <p>Ingresa tus credenciales de administrador:</p>
        <ul>
            <li>Usa el token de administrador en el campo de arriba</li>
        </ul>
    `);
    
    // Focus on token input
    loginTokenInput.focus();
    loginForm.classList.remove('loading');
  });

  // Handle form submission
  loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const token = loginTokenInput.value.trim();
    
    if (!token) {
        showError('Ingresa tu token de acceso');
        $('#loginToken').focus();
        return;
    }
    
    loginForm.classList.add('loading');
     
    setTimeout(() => {
        if (isAdminLogin) {
            handleAdminLogin(token,true);
        } else {
            handleRegularLogin(token,true);
        }
        
        loginForm.classList.remove('loading');
    }, 1000);
  });

  $('#menulogout').on('click',function(e) {
    $('.adminlogin').hide();
    e.preventDefault();
    removeLocalStorageItem('isAdmin');
    removeLocalStorageItem('admintoken');
    removeLocalStorageItem('token');
    removeLocalStorageItem('currentInstance');
    currentInstanceData = null; // Clear instance data
    window.location.reload();
    return false;
  });

  document.getElementById('pairphoneinput').addEventListener('keypress', async function(e) {
    if (e.key !== 'Enter') return;

    e.preventDefault();
    const input = e.currentTarget;
    const phone = input.value.trim();
    if (!phone || input.disabled) return;

    // This modal is shown only after /session/connect has established the
    // WhatsApp socket. Calling connect() again here made the pairing flow fail
    // with "already connected" before /session/pairphone was ever requested.
    input.disabled = true;
    try {
      const data = await pairPhone(phone);
      document.getElementById('pairHelp').classList.add('hidden');
      if (data.success && data.data && data.data.LinkingCode) {
        document.getElementById('pairInfo').textContent = `Tu código de emparejamiento es: ${data.data.LinkingCode}`;
      } else {
        document.getElementById('pairInfo').textContent = `No se pudo obtener el código de emparejamiento: ${data.error || 'error desconocido'}`;
      }
    } catch (error) {
      document.getElementById('pairInfo').textContent = "No se pudo obtener el código de emparejamiento: falló la solicitud";
      console.error('Pairing error:', error);
    } finally {
      input.disabled = false;
    }
  });

  document.getElementById('userinfoinput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      doUserInfo();
    }
  });
 
  document.getElementById('useravatarinput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      doUserAvatar();
    }
  });

  document.getElementById('userInfo').addEventListener('click', function() {
    resetBusinessProfile();
    document.getElementById('userInfoContainer').innerHTML='';
    document.getElementById("userInfoContainer").classList.add('hidden');
    $('#modalUserInfo').modal({onApprove: function() {
      doUserInfo();
      return false;
    }}).modal('show');
  });

  document.getElementById('userAvatar').addEventListener('click', function() {
    document.getElementById('userAvatarContainer').innerHTML='';
    document.getElementById("userAvatarContainer").classList.add('hidden');
    $('#modalUserAvatar').modal({onApprove: function() {
      doUserAvatar();
      return false;
    }}).modal('show');
  });

  document.getElementById('messagesendphone').addEventListener('input', updateMentionAllAvailability);
  document.getElementById('getBusinessProfile').addEventListener('click', doBusinessProfile);
  document.getElementById('userinfoinput').addEventListener('input', resetBusinessProfile);

  document.getElementById('sendTextMessage').addEventListener('click', function() {
    const container = document.getElementById('sendMessageContainer');
    container.textContent = '';
    container.classList.add('hidden');
    document.getElementById('messageMentionAll').checked = false;
    updateMentionAllAvailability();
    let sending = false;
    $('#modalSendTextMessage').modal({onApprove: function() {
      if (sending) return false;
      sending = true;
      const button = document.querySelector('#modalSendTextMessage .positive');
      button.classList.add('disabled', 'loading');
      sendTextMessage().then(result => {
        container.textContent = result.success === true
          ? `Mensaje enviado. ID: ${result.data.Id}`
          : `No se envió el mensaje: ${result.error || 'Error desconocido'}`;
      }).catch(error => {
        container.textContent = `No se envió el mensaje: ${error.message}`;
      }).finally(() => {
        sending = false;
        button.classList.remove('disabled', 'loading');
        container.classList.remove('hidden');
      });
      return false;
    }}).modal('show');
  });

  document.getElementById('deleteMessage').addEventListener('click', function() {
    document.getElementById('deleteMessageContainer').innerHTML='';
    document.getElementById("deleteMessageContainer").classList.add('hidden');
    $('#modalDeleteMessage').modal({onApprove: function() {
      deleteMessage().then((result)=>{
        console.log(result);
        document.getElementById("deleteMessageContainer").classList.remove('hidden');
        if(result.success===true) {
           document.getElementById('deleteMessageContainer').innerHTML=`Mensaje eliminado.`
        } else {
           document.getElementById('deleteMessageContainer').innerHTML=`No se eliminó el mensaje: ${result.error}`
        }
      });
      return false;
    }}).modal('show');
  });
  
  document.getElementById('userContacts').addEventListener('click', function() {
    getContacts();
  });

  // Configuración de S3
  document.getElementById('s3Config').addEventListener('click', function() {
    $('#modalS3Config').modal({
      onApprove: function() {
        saveS3Config();
        return false;
      }
    }).modal('show');
    loadS3Config();
  });

  // Configuración del historial
  document.getElementById('historyConfig').addEventListener('click', function() {
    $('#modalHistoryConfig').modal({
      onApprove: function() {
        saveHistoryConfig();
        return false;
      }
    }).modal('show');
    loadHistoryConfig();
  });

  // Configuración del proxy
  document.getElementById('proxyConfig').addEventListener('click', function() {
    $('#modalProxyConfig').modal({
      onApprove: function() {
        saveProxyConfig();
        return false;
      }
    }).modal('show');
    loadProxyConfig();
  });

  // Webhook Configuration
  document.getElementById('webhookConfig').addEventListener('click', function() {
    webhookModal();
  });

  // S3 Probar conexión
  document.getElementById('testS3Connection').addEventListener('click', function() {
    testS3Connection();
  });

  // S3 Eliminar configuración
  document.getElementById('deleteS3Config').addEventListener('click', function() {
    deleteS3Config();
  });

  // Configuración HMAC
  document.getElementById('hmacConfig').addEventListener('click', function() {
    $('#modalHmacConfig').modal({
      onApprove: function() {
        saveHmacConfig();
        return false;
      }
    }).modal('show');
    loadHmacConfig();
  });

  // HMAC Generate Key
  document.getElementById('generateHmacKey').addEventListener('click', function() {
    generateRandomHmacKey();
  });

  // HMAC Show/Ocultar clave
  document.getElementById('showHmacKey').addEventListener('click', function() {
    toggleHmacKeyVisibility();
  });

  document.getElementById('hideHmacKey').addEventListener('click', function() {
    toggleHmacKeyVisibility();
  });

  // HMAC Eliminar configuración
  document.getElementById('deleteHmacConfig').addEventListener('click', function() {
    deleteHmacConfig();
  });

  // HMAC Instance Generate Key
  document.getElementById('generateHmacKeyInstance').addEventListener('click', function() {
    generateRandomHmacKeyInstance();
  });

  // HMAC Instance Show/Ocultar clave
  document.getElementById('showHmacKeyInstance').addEventListener('click', function() {
    toggleHmacKeyVisibilityInstance();
  });

  document.getElementById('hideHmacKeyInstance').addEventListener('click', function() {
    toggleHmacKeyVisibilityInstance();
  });

  // Proxy checkbox toggle is now initialized in DOMContentLoaded

  $('#addInstanceButton').click(function() {
    $('#addInstanceModal').modal({
      onApprove: function(e,pp) {
         $('#addInstanceForm').submit();
         return false;
      }
    }).modal('show');
  });
  
  $('#addInstanceForm').form({
    fields: {
      name: {
        identifier: 'name',
        rules: [{
          type: 'empty',
          prompt: 'Ingresa un nombre para la instancia'
        }]
      },
      token: {
        identifier: 'token',
        rules: [{
          type: 'empty',
          prompt: 'Ingresa un token de autenticación para la instancia'
        }]
      },
      events: {
        identifier: 'events',
        rules: [{
          type: 'empty',
          prompt: 'Selecciona al menos un evento'
        }]
      },
      history: {
        identifier: 'history',
        optional: true,
        rules: [{
          type: 'integer[0..]',
          prompt: 'El historial debe ser un entero mayor o igual a 0'
        }]
      },
      days_to_sync_history: {
        identifier: 'days_to_sync_history',
        optional: true,
        rules: [{
          type: 'integer[0..365]',
          prompt: 'Los días de sincronización deben ser un entero entre 0 y 365'
        }]
      },
      proxy_url: {
        identifier: 'proxy_url',
        optional: true,
        rules: [{
          type: 'regExp[^(https?|socks5)://.*]',
          prompt: 'La URL del proxy debe empezar con http://, https:// o socks5://'
        }]
      },
      s3_endpoint: {
        identifier: 's3_endpoint',
        optional: true,
        rules: [{
          type: 'url',
          prompt: 'Ingresa una URL de endpoint de S3 válida'
        }]
      },
      s3_bucket: {
        identifier: 's3_bucket',
        optional: true,
        rules: [{
          type: 'regExp[^[a-z0-9][a-z0-9.-]*[a-z0-9]$]',
          prompt: 'Ingresa un nombre de bucket de S3 válido'
        }]
      }
    },
    onSuccess: function(event, fields) {
      event.preventDefault();

      // Validate conditional fields
      const proxyEnabled = fields.proxy_enabled === 'on' || fields.proxy_enabled === true;
      const s3Enabled = fields.s3_enabled === 'on' || fields.s3_enabled === true;
      const hmacEnabled = fields.hmac_enabled === 'on' || fields.hmac_enabled === true;

      if (proxyEnabled && !fields.proxy_url) {
        showError('La URL del proxy es obligatoria si el proxy está activado');
        return false;
      }

      if (s3Enabled) {
        if (!fields.s3_bucket) {
          showError('El nombre del bucket es obligatorio si S3 está activado');
          return false;
        }
        if (!fields.s3_access_key) {
          showError('La clave de acceso de S3 es obligatoria si S3 está activado');
          return false;
        }
        if (!fields.s3_secret_key) {
          showError('La clave secreta de S3 es obligatoria si S3 está activado');
          return false;
        }
      }

      if (hmacEnabled && !fields.hmac_key) {
        showError('La clave HMAC es obligatoria si HMAC está activado');
        return false;
      }

      if (hmacEnabled && fields.hmac_key && fields.hmac_key.length < 32) {
        showError('La clave HMAC debe tener al menos 32 caracteres');
        return false;
      }

      addInstance(fields).then((result) => {
        if (result.success) {
          showSuccess('Instancia creada');
          // Refresh the instances list
          updateAdmin();
        } else {
          showError('No se creó la instancia: ' + (result.error || 'Error desconocido'));
        }
      }).catch((error) => {
        showError('Error al crear la instancia: ' + error.message);
      });

      $('#addInstanceModal').modal('hide');
      $('#addInstanceForm').form('reset');
      $('.wsp-dropdown').dropdown('restore defaults');
      // Reset toggles
      $('#addInstanceProxyToggle').checkbox('set unchecked');
      $('#addInstanceS3Toggle').checkbox('set unchecked');
      $('#addInstanceHmacToggle').checkbox('set unchecked');
      $('#addInstanceProxyUrlField').hide();
      $('#addInstanceProxyWebhookUseProxyField').hide();
      $('#addInstanceProxyWebhookUseProxyToggle').checkbox('set checked');
      $('#addInstanceS3Fields').hide();
      $('#addInstanceHmacKeyWarningMessage').hide();
      $('#addInstanceHmacKeyField').hide();
    }
  });

  init();
});

async function addInstance(data) {
  console.log("Add Instance...");
  const admintoken = getLocalStorageItem('admintoken');
  const myHeaders = new Headers();
  myHeaders.append('authorization', admintoken);
  myHeaders.append('Content-Type', 'application/json');

  // Build proxy configuration
  const proxyEnabled = data.proxy_enabled === 'on' || data.proxy_enabled === true;
  const proxyWebhookUseProxy = data.proxy_webhook_use_proxy === 'on' || data.proxy_webhook_use_proxy === true;
  const proxyConfig = {
    enabled: proxyEnabled,
    proxyURL: proxyEnabled ? (data.proxy_url || '') : '',
    webhookUseProxy: proxyEnabled ? proxyWebhookUseProxy : true
  };
  
  // Build S3 configuration
  const s3Enabled = data.s3_enabled === 'on' || data.s3_enabled === true;
  const s3PathStyle = data.s3_path_style === 'on' || data.s3_path_style === true;
  const s3Config = {
    enabled: s3Enabled,
    endpoint: s3Enabled ? (data.s3_endpoint || '') : '',
    region: s3Enabled ? (data.s3_region || '') : '',
    bucket: s3Enabled ? (data.s3_bucket || '') : '',
    accessKey: s3Enabled ? (data.s3_access_key || '') : '',
    secretKey: s3Enabled ? (data.s3_secret_key || '') : '',
    pathStyle: s3PathStyle,
    publicURL: s3Enabled ? (data.s3_public_url || '') : '',
    mediaDelivery: s3Enabled ? (data.s3_media_delivery || 'base64') : 'base64',
    retentionDays: s3Enabled ? (parseInt(data.s3_retention_days) || 30) : 30
  };

  // Build HMAC configuration
  const hmacEnabled = data.hmac_enabled === 'on' || data.hmac_enabled === true;
  const hmacKey = hmacEnabled ? (data.hmac_key || '') : '';

  const payload = {
    name: data.name,
    token: data.token,
    events: data.events.join(','),
    webhook: data.webhook_url || '',
    expiration: 0,
    history: parseInt(data.history) || 0,
    days_to_sync_history: Number(data.days_to_sync_history || 0),
    proxyConfig: proxyConfig,
    s3Config: s3Config,
    hmacKey: hmacKey
  };

  console.log("Payload being sent:", payload);

  res = await fetch(baseUrl + "/admin/users", {
    method: "POST",
    headers: myHeaders,
    body: JSON.stringify(payload)
  });

  const responseData = await res.json();
  console.log("Response:", responseData);
  return responseData;
}

function webhookModal() {
  getWebhook().then((response)=>{
    if(response.success==true) {
      $('#webhookEvents').val(response.data.subscribe);
      $('#webhookEvents').dropdown('set selected', response.data.subscribe);
      $('#webhookinput').val(response.data.webhook);
      $('#modalSetWebhook').modal({onApprove: function() {
        setWebhook().then((result)=>{
          if(result.success===true) {
             $.toast({ class: 'success', message: `Webhook guardado`});
          } else {
             $.toast({ class: 'error', message: `No se guardó el webhook: ${result.error}`});
          }
        });
        return true;
      }}).modal('show');
    }
  });
}

function modalPairPhone() {
  $('#modalLoginWithCode').modal({
     onVisible: function() {
       document.getElementById('pairInfo').classList.remove('hidden');;
       document.getElementById('pairHelp').classList.remove('hidden');;
     },
     onHidden: function() {
       if(scanned==true) {
           document.getElementById('loginQR').classList.add('hidden');
           document.getElementById('loginCode').classList.add('hidden');
           document.getElementById('logoutWidget').classList.remove('hidden');
       }
     }
   })
   .modal('show');
}

function handleRegularLogin(token,notifications=false) {
  console.log('Regular login with token:', token);
  setLocalStorageItem('token', token, 6);
  removeLocalStorageItem('isAdmin');
  $('.adminlogin').hide();
  statusRequest().then((status) => {
    if(status.success==true) {
      console.log(status.data);
      setLocalStorageItem('currentInstance', status.data.id, 6);
      // Save current user JID for groups functionality
      if(status.data.jid) {
        setLocalStorageItem('currentUserJID', status.data.jid, 6);
        window.currentUserJID = status.data.jid;
      }
      populateInstances([status.data]);
      showRegularUser();
      $('.logingrid').addClass('hidden');
      $('.admingrid').addClass('hidden');
      $('.maingrid').removeClass('hidden');
      $('.adminlogin').hide();
      showWidgets();
      $('#'+status.data.instanceId).removeClass('hidden');
      updateUser();
    } else {
      removeLocalStorageItem('token');
      showError("Credenciales inválidas");
      $('#loginToken').focus();
    }
  });
}
  
function updateUser() {
  // retrieves one instance status at regular interval
  status().then((result)=> {
    if(result.success==true) {
      // Save current user JID for groups functionality
      if(result.data.jid) {
        setLocalStorageItem('currentUserJID', result.data.jid, 6);
        window.currentUserJID = result.data.jid;
      }
      populateInstances([result.data]);
    } 
  });
  clearTimeout(updateUserTimeout)
  updateUserTimeout = setTimeout(function() { updateUser() }, updateInterval);
}

function updateAdmin() {
  // retrieves all instances status at regular intervals
  const current = getLocalStorageItem("currentInstance")
  if(!current) {
    // get all instances status
    getUsers().then((result) => {
      if(result.success==true) {
        populateInstances(result.data)
      } 
    });
    loadProxyPool();
  } else {
    // get only active instance status
    status().then((result)=> {
      if(result.success==true) {
        populateInstances([result.data]);
      } 
    });
  }
  clearTimeout(updateAdminTimeout)
  updateAdminTimeout = setTimeout(function() { updateAdmin() }, updateInterval);
}

function handleAdminLogin(token,notifications=false) {
  console.log('Admin login with token:', token);
  setLocalStorageItem('admintoken', token, 6);
  setLocalStorageItem('isAdmin', true, 6);
  const currentInstance = getLocalStorageItem("currentInstance");
  // "Go Back" only makes sense while an instance is open, not on the list.
  $('.adminlogin').toggle(currentInstance != null);

  getUsers().then((result) => {
    if(result.success==true) {

      showAdminUser();

      if(currentInstance == null) {
        $('.admingrid').removeClass('hidden');
        populateInstances(result.data);
      } else {
        populateInstances(result.data);
        $('.maingrid').removeClass('hidden');
        showWidgets();
        const showInstanceId=`instance-card-${currentInstance}`
        $('#'+showInstanceId).removeClass('hidden');
      }
      $('#loading').removeClass('active');
      $('.logingrid').addClass('hidden');
      loadProxyPool();
      updateAdmin();
    } else {
      removeLocalStorageItem('admintoken');
      removeLocalStorageItem('token');
      removeLocalStorageItem('isAdmin');
      showError("No se pudo iniciar sesión como administrador");
      $('#loginToken').focus();
    }
  });
}
    
function showError(message) {
  $('body').toast({
    class: 'error',
    message: message,
    showIcon: 'exclamation circle',
    position: 'top center',
    showProgress: 'bottom'
  });
}
    
function showSuccess(message) {
  $('body').toast({
    class: 'success',
    message: message,
    showIcon: 'check circle',
    position: 'top center',
    showProgress: 'bottom'
  });
}

function deleteInstance(id) {
  if (deletionInProgress) return;
  $('#deleteInstanceModal').modal({
    closable: false,
    onDeny: () => !deletionInProgress,
    onApprove: function() {
      performDelete(id);
      return false;
    }
  }).modal('show');
}

function showPreserveDevicesRecovery(id) {
  $('#preserveDevicesModal').modal({
    closable: false,
    onDeny: () => !deletionInProgress,
    onApprove: function() {
      performDelete(id, true);
      return false;
    }
  }).modal('show');
}

async function performDelete(id, preserveDevices = false) {
  if (deletionInProgress) return;
  deletionInProgress = true;
  const modal = preserveDevices ? '#preserveDevicesModal' : '#deleteInstanceModal';
  const buttons = $(modal + ' footer button');
  buttons.addClass('disabled');
  $(modal + ' footer .positive').addClass('loading');
  let offerRecovery = false;
  try {
    const headers = new Headers();
    headers.append('authorization', getLocalStorageItem('admintoken'));
    const suffix = preserveDevices ? '/preserve-devices' : '/full';
    const response = await fetch(baseUrl + '/admin/users/' + encodeURIComponent(id) + suffix, {
      method: 'DELETE', headers
    });
    const data = await response.json();
    if (response.ok && data.success === true) {
      $(modal).modal('hide');
      updateAdmin();
      showDeleteSuccess(preserveDevices);
    } else if (!preserveDevices && response.status === 409 && data.error_code === 'ambiguous_device_ownership') {
      offerRecovery = true;
    } else {
      showError(data.error || 'Error al eliminar la instancia');
    }
  } catch (error) {
    showError('No se pudo eliminar la instancia. Revisa tu conexión e inténtalo de nuevo.');
  } finally {
    deletionInProgress = false;
    buttons.removeClass('disabled');
    $(modal + ' footer .positive').removeClass('loading');
  }
  if (offerRecovery) {
    // Open the recovery confirmation only after the first modal has closed.
    $(modal).modal('setting', 'onHidden', function() {
      $(modal).modal('setting', 'onHidden', function() {});
      showPreserveDevicesRecovery(id);
    }).modal('hide');
  }
}

function showDeleteSuccess(preserveDevices = false) {
  $('body').toast({
    class: 'success',
    message: preserveDevices ? 'Instancia eliminada; se conservaron las credenciales de WhatsApp' : 'Instancia eliminada',
    position: 'top right',
    showProgress: 'bottom'
  });
}

function openDashboard(id,token) {
  setLocalStorageItem('currentInstance', id, 6);
  setLocalStorageItem('token', token, 6);
  $(`#instance-card-${id}`).removeClass('hidden');
  console.log($(`#instance-card-${id}`));
  showWidgets();
  $('.admingrid').addClass('hidden');
  $('.maingrid').removeClass('hidden');
  $('.no-hover').addClass('hidden');
  $(`#instance-card-${id}`).removeClass('hidden');
  $('.adminlogin').show();
}

function goBackToList() {
  $('#instances-cards > div').addClass('hidden');
  removeLocalStorageItem('currentInstance');
  currentInstanceData = null; // Clear instance data
  updateAdmin();
  removeLocalStorageItem('token');
  hideWidgets();
  $('.maingrid').addClass('hidden');
  $('.admingrid').removeClass('hidden');
  $('.adminlogin').hide();
}

function updateMentionAllAvailability() {
  const phone = document.getElementById('messagesendphone').value.trim();
  const checkbox = document.getElementById('messageMentionAll');
  checkbox.disabled = !/^\d+(?:-\d+)?@g\.us$/.test(phone);
  if (checkbox.disabled) checkbox.checked = false;
}

async function sendTextMessage() {
  const phone = document.getElementById('messagesendphone').value.trim();
  const body = document.getElementById('messagesendtext').value;
  const mentionAll = document.getElementById('messageMentionAll').checked;
  if (!phone || !body.trim()) throw new Error('Ingresa un destinatario y un mensaje.');
  if (mentionAll && !/^\d+(?:-\d+)?@g\.us$/.test(phone)) {
    throw new Error('Mencionar a todos requiere un JID de grupo que termine en @g.us.');
  }
  const response = await fetch(baseUrl + '/chat/send/text', {
    method: 'POST',
    headers: {token: getLocalStorageItem('token'), 'Content-Type': 'application/json'},
    body: JSON.stringify({Phone: phone, Body: body, Id: generateMessageUUID(), MentionAll: mentionAll})
  });
  return response.json();
}

async function deleteMessage() {
  const deletePhone = document.getElementById('messagedeletephone').value.trim();
  const deleteId = document.getElementById('messagedeleteid').value;
  const myHeaders = new Headers();
  myHeaders.append('token', token);
  myHeaders.append('Content-Type', 'application/json');
  res = await fetch(baseUrl + "/chat/delete", {
    method: "POST",
    headers: myHeaders,
    body: JSON.stringify({Phone: deletePhone, Id: deleteId})
  });
  data = await res.json();
  return data;
}
 
async function setWebhook() {
  const token = getLocalStorageItem('token');
  const webhook = document.getElementById('webhookinput').value.trim();
  const events = $('#webhookEvents').dropdown('get value')
  if (events.includes("All")) {
    events.length = 0;
    events.push("All");
  }
  const myHeaders = new Headers();
  myHeaders.append('token', token);
  myHeaders.append('Content-Type', 'application/json');
  res = await fetch(baseUrl + "/webhook", {
    method: "POST",
    headers: myHeaders,
    body: JSON.stringify({webhookurl: webhook, events: events})
  });
  data = await res.json();
  return data;
}
 
function doUserAvatar() {
  const userAvatarInput = document.getElementById('useravatarinput');
  let phone = userAvatarInput.value.trim();
  if (phone) {
    if (!phone.endsWith('@s.whatsapp.net')) {
      phone = phone.includes('@') ? phone : phone + '@s.whatsapp.net';
    }
    userAvatar(phone).then((data) => {
      document.getElementById("userAvatarContainer").classList.remove('hidden');
      if (data.success && data.data && data.data.url) {
        const userAvatarDiv = document.getElementById('userAvatarContainer');
        userAvatarDiv.innerHTML=`<img src="${data.data.url}" alt="Foto de perfil" class="user-avatar">`;
      } else {
          document.getElementById('userAvatarContainer').innerHTML = 'No se encontró el avatar del usuario';
      }
    }).catch(error => {
      document.getElementById('userAvatarContainer').innerHTML = 'Error al obtener el avatar';
      console.error('Error:', error);
    });
  }
} 

function doUserInfo() {
  const userInfoInput = document.getElementById('userinfoinput');
  let phone = userInfoInput.value.trim();
  if (phone) {
    if (!phone.endsWith('@s.whatsapp.net')) {
      phone = phone.includes('@') ? phone : phone + '@s.whatsapp.net';
    }
    userInfo(phone).then((data) => {
      document.getElementById("userInfoContainer").classList.remove('hidden');
      if (data.success && data.data && data.data.Users) {
          const userInfoDiv = document.getElementById('userInfoContainer');
          userInfoDiv.innerHTML = '';
          
          for (const [userJid, userData] of Object.entries(data.data.Users)) {
              const userElement = document.createElement('div');
              userElement.className = 'user-entry';
              
              const phoneNumber = userJid.split('@')[0];
              userElement.innerHTML += `<strong>Teléfono: ${phoneNumber}</strong><br>`;
              userElement.innerHTML += `Estado: ${userData.Status || 'No disponible'}<br>`;
              userElement.innerHTML += `Nombre verificado: ${userData.VerifiedName || 'Sin verificar'}<br>`;
              if (userData.Devices && userData.Devices.length > 0) {
                  userElement.innerHTML += `Dispositivos: ${userData.Devices.length}<br>`;
              }
              userInfoDiv.appendChild(userElement);
          }
      } else {
          document.getElementById('userInfoContainer').innerHTML = 'No se encontraron datos del usuario';
      }
    }).catch(error => {
      document.getElementById('userInfoContainer').innerHTML = 'Error al obtener la información del usuario';
      console.error('Error:', error);
    });
  }
}

function showWidgets() {
  document.querySelectorAll('.widget').forEach(widget => {
    widget.classList.remove('hidden');
  });
}

function hideWidgets() {
  document.querySelectorAll('.widget').forEach(widget => {
    widget.classList.add('hidden');
  });
}

async function connect(token='') {
  console.log("Connecting...");
  if(token=='') {
     token = getLocalStorageItem('token');
  }
  const myHeaders = new Headers();
  myHeaders.append('token', token);
  myHeaders.append('Content-Type', 'application/json');
  res = await fetch(baseUrl + "/session/connect", {
    method: "POST",
    headers: myHeaders,
    body: JSON.stringify({Subscribe: ['All'], Immediate: true})
  });
  data = await res.json();
  updateInterval=1000; // Decrease interval to react quicker to QR scan
  return data;
}

async function disconnect(token) {
  console.log("Disconnecting...");
  if(token=='') {
     token = getLocalStorageItem('token');
  }
  const myHeaders = new Headers();
  myHeaders.append('token', token);
  myHeaders.append('Content-Type', 'application/json');
  res = await fetch(baseUrl + "/session/disconnect", {
    method: "POST",
    headers: myHeaders,
  });
  data = await res.json();
  return data;
}

async function status() {
  console.log("Get status...");
  const token = getLocalStorageItem('token');
  const myHeaders = new Headers();
  myHeaders.append('token', token);
  myHeaders.append('Content-Type', 'application/json');
  res = await fetch(baseUrl + "/session/status", {
    method: "GET",
    headers: myHeaders
  });
  data = await res.json();
  if(data.data.loggedIn==true) updateInterval=5000;
  return data;
}

async function getUsers() {
  console.log("Get users...");
  const admintoken = getLocalStorageItem('admintoken');
  const myHeaders = new Headers();
  myHeaders.append('authorization', admintoken);
  myHeaders.append('Content-Type', 'application/json');
  res = await fetch(baseUrl + "/admin/users", {
    method: "GET",
    headers: myHeaders
  });
  data = await res.json();
  return data;
}

async function getWebhook(token='') {
  console.log("Getting webhook...");
  if(token=='') {
    token = getLocalStorageItem('token');
  }
  const myHeaders = new Headers();
  myHeaders.append('token', token);
  myHeaders.append('Content-Type', 'application/json');
  try {
    const res = await fetch(baseUrl + "/webhook", {
      method: "GET",
      headers: myHeaders,
    });
    data = await res.json();
    return data;
  } catch (error) {
    return '{}';
    throw error;
  }
}

async function getContacts() {
  console.log("Getting contacts...");
  const token = getLocalStorageItem('token');
  const myHeaders = new Headers();
  myHeaders.append('token', token);
  myHeaders.append('Content-Type', 'application/json');
  try {
    const res = await fetch(baseUrl + "/user/contacts", {
      method: "GET",
      headers: myHeaders,
    });
    data = await res.json();
    if (data.code === 200) {
      const transformedContacts = Object.entries(data.data).map(([phone, contact]) => ({
          FullName: contact.FullName || "",
          PushName: contact.PushName || "",
          Phone: phone.split('@')[0] // Remove the @s.whatsapp.net part
      }));
      downloadJson(transformedContacts, 'contacts.json');
      return transformedContacts;
    } else {
      throw new Error(`API returned code ${data.code}`);
    }
  } catch (error) {
    console.error("Error fetching contacts:", error);
    throw error;
  }
}

async function userAvatar(phone) {
  console.log("Requesting user avatar...");
  const token = getLocalStorageItem('token');
  const myHeaders = new Headers();
  myHeaders.append('token', token);
  myHeaders.append('Content-Type', 'application/json');
  res = await fetch(baseUrl + "/user/avatar", {
    method: "POST",
    headers: myHeaders,
    body: JSON.stringify({Phone: phone, Preview: false})
  });
  data = await res.json();
  return data;
}

async function userInfo(phone) {
  console.log("Requesting user info...");
  const token = getLocalStorageItem('token');
  const myHeaders = new Headers();
  myHeaders.append('token', token);
  myHeaders.append('Content-Type', 'application/json');
  res = await fetch(baseUrl + "/user/info", {
    method: "POST",
    headers: myHeaders,
    body: JSON.stringify({Phone: [phone]})
  });
  data = await res.json();
  return data;
}

async function pairPhone(phone) {
  console.log("Requesting pairing code...");
  const token = getLocalStorageItem('token');
  const myHeaders = new Headers();
  myHeaders.append('token', token);
  myHeaders.append('Content-Type', 'application/json');
  const res = await fetch(baseUrl + "/session/pairphone", {
    method: "POST",
    headers: myHeaders,
    body: JSON.stringify({Phone: phone})
  });
  const data = await res.json();
  return data;
}

async function logout(token='') {
  console.log("Login out...");
  if(token=='') {
    token = getLocalStorageItem('token');
  }
  const myHeaders = new Headers();
  myHeaders.append('token', token);
  myHeaders.append('Content-Type', 'application/json');
  res = await fetch(baseUrl + "/session/logout", {
    method: "POST",
    headers: myHeaders,
  });
  data = await res.json();
  return data;
}

async function getQr() {
  const myHeaders = new Headers();
  const token = getLocalStorageItem('token');
  myHeaders.append('token', token);
  res = await fetch(baseUrl + "/session/qr", {
    method: "GET",
    headers: myHeaders,
  });
  data = await res.json();
  return data;
}

async function statusRequest() {
  const myHeaders = new Headers();
  const token = getLocalStorageItem('token');
  const isAdminLogin = getLocalStorageItem('isAdmin');
  if(token!=null && isAdminLogin==null) {
    myHeaders.append('token', token);
    res = await fetch(baseUrl + "/session/status", {
      method: "GET",
      headers: myHeaders,
    });
    data = await res.json();
    return data;
  }
}

function parseURLParams(url) {
  var queryStart = url.indexOf("?") + 1,
      queryEnd   = url.indexOf("#") + 1 || url.length + 1,
      query = url.slice(queryStart, queryEnd - 1),
      pairs = query.replace(/\+/g, " ").split("&"),
      parms = {}, i, n, v, nv;

  if (query === url || query === "") return;
    for (i = 0; i < pairs.length; i++) {
      nv = pairs[i].split("=", 2);
      n = decodeURIComponent(nv[0]);
      v = decodeURIComponent(nv[1]);
      if (!parms.hasOwnProperty(n)) parms[n] = [];
      parms[n].push(nv.length === 2 ? v : null);
  }
  return parms;
}

function downloadJson(data, filename) {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  
  // Cleanup
  setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  }, 100);
}

function generateMessageUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function init() { 

  // Starting
  let notoken=0;
  let token = getLocalStorageItem('token');
  let admintoken = getLocalStorageItem('admintoken');
  let isAdminLogin = getLocalStorageItem('isAdmin');
  $('.adminlogin').hide();

  if(token == null && admintoken == null) {
    $('.logingrid').removeClass('hidden');
    $('.maingrid').addClass('hidden');
  } else {
    if (isAdminLogin) {
      handleAdminLogin(admintoken);
    } else {
      handleRegularLogin(token);
    }
  }
}

// ===== Passkey functions =====
let currentPasskeyPublicKey = null;
let passkeyPollInterval = null;
let passkeyPollTimeout = null;

/**
 * Clear any active passkey polling interval and timeout.
 * Call this when modal closes, connection succeeds, or navigating away.
 */
function clearPasskeyPolling() {
  if (passkeyPollInterval) { clearInterval(passkeyPollInterval); passkeyPollInterval = null; }
  if (passkeyPollTimeout) { clearTimeout(passkeyPollTimeout); passkeyPollTimeout = null; }
}

function formatPasskeyCode(publicKey) {
  const pkStr = JSON.stringify(publicKey, null, 2);
  return `const publicKey = ${pkStr};\n\n(async () => {\n  const credential = await navigator.credentials.get({\n    publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(publicKey)\n  });\n  console.log(JSON.stringify(credential.toJSON()));\n})();`;
}

function copyPasskeyCode() {
  const code = document.getElementById('passkeyCodeBlock').textContent;
  navigator.clipboard.writeText(code).then(() => {
    $.toast({ class: 'success', message: 'Código copiado' });
  }).catch(() => {
    const textarea = document.createElement('textarea');
    textarea.value = code;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    $.toast({ class: 'success', message: 'Código copiado' });
  });
}

function showPasskeyModal(publicKey) {
  currentPasskeyPublicKey = publicKey;
  const code = formatPasskeyCode(publicKey);
  document.getElementById('passkeyCodeBlock').textContent = code;
  document.getElementById('passkeyResponseInput').value = '';
  $('#modalPasskeyPairing')
    .modal({
      closable: true,
      onHidden: function() { clearPasskeyPolling(); }
    })
    .modal('show');
}

async function submitPasskeyResponse() {
  const input = document.getElementById('passkeyResponseInput').value.trim();
  if (!input) {
    $.toast({ class: 'error', message: 'Pega el resultado de la consola antes de enviar.' });
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(input);
  } catch (e) {
    $.toast({ class: 'error', message: 'JSON inválido. Revisa el formato e inténtalo de nuevo.' });
    return;
  }

  const btn = document.getElementById('sendPasskeyBtn');
  btn.classList.add('loading');

  const token = getLocalStorageItem('token');
  const myHeaders = new Headers();
  myHeaders.append('token', token);
  myHeaders.append('Content-Type', 'application/json');

  try {
    const res = await fetch(baseUrl + "/session/passkey-response", {
      method: "POST",
      headers: myHeaders,
      body: JSON.stringify({ response: parsed })
    });
    const data = await res.json();
    const errorDetail = data.errors?.error || data.error;

    if (!res.ok || !data.success) {
      $.toast({ class: 'error', message: 'Error al enviar la passkey: ' + (errorDetail || 'Error desconocido') });
      btn.classList.remove('loading');
      return;
    }

    const status = data.data?.status || data.status;

    if (status === 'passkey_finished') {
      $.toast({ class: 'success', message: 'Canal conectado' });
      $('#modalPasskeyPairing').modal('hide');
      updateInterval = 5000;
      btn.classList.remove('loading');
      return;
    }

    if (status === 'passkey_response_sent') {
      $.toast({ class: 'info', message: 'Respuesta enviada. Esperando la confirmación de WhatsApp…' });

      // Now call passkey-confirm to trigger the pairing code display
      const confirmRes = await fetch(baseUrl + "/session/passkey-confirm", {
        method: "POST",
        headers: myHeaders,
        body: JSON.stringify({})
      });
      const confirmData = await confirmRes.json();
      const confirmError = confirmData.errors?.error || confirmData.error;

      if (!confirmRes.ok || !confirmData.success) {
        $.toast({ class: 'error', message: 'Error al confirmar: ' + (confirmError || 'Unknown') });
        btn.classList.remove('loading');
        return;
      }

      const confirmStatus = confirmData.data?.status || confirmData.status;

      if (confirmStatus === 'passkey_finished') {
        // Connected immediately (SkipHandoffUX was true)
        $.toast({ class: 'success', message: 'Canal conectado' });
        $('#modalPasskeyPairing').modal('hide');
        updateInterval = 5000;
      } else if (confirmStatus === 'passkey_confirmed') {
        // Confirmation sent — now wait for status to change via polling
        $.toast({ class: 'success', message: 'Passkey confirmada. Esperando la conexión…' });
        document.getElementById('passkeyCodeBlock').textContent = 'Esperando la conexión…';
        document.getElementById('passkeyResponseInput').value = '';
        document.getElementById('passkeyResponseInput').placeholder = 'Esperando la confirmación de WhatsApp…';

        // Start polling — the modal stays open until loggedIn becomes true
        startPasskeyPolling(token);
      } else {
        $.toast({ class: 'success', message: 'Passkey confirmada. Esperando la conexión…' });
        $('#modalPasskeyPairing').modal('hide');
      }
    } else {
      $.toast({ class: 'success', message: 'Respuesta de passkey enviada.' });
      $('#modalPasskeyPairing').modal('hide');
    }
  } catch (err) {
    $.toast({ class: 'error', message: 'Error de red: ' + err.message });
  }

  btn.classList.remove('loading');
}

function startPasskeyPolling(token) {
  // Clear any existing polling before starting a new one
  clearPasskeyPolling();

  passkeyPollInterval = setInterval(async () => {
    try {
      const myHeaders = new Headers();
      myHeaders.append('token', token);
      const res = await fetch(baseUrl + "/session/status", {
        method: "GET",
        headers: myHeaders,
      });
      const data = await res.json();

      if (data.success && data.data) {
        if (data.data.loggedIn) {
          // Connected!
          clearPasskeyPolling();
          $.toast({ class: 'success', message: 'Canal conectado' });
          $('#modalPasskeyPairing').modal('hide');
          updateInterval = 5000;
        } else if (!data.data.passkeyPending) {
          // Passkey was consumed but not yet logged in — keep polling briefly
        } else {
          // Still waiting
        }
      }
    } catch (e) {
      // Silently continue polling on network errors
    }
  }, 2000);

  // Safety: stop polling after 60 seconds
  passkeyPollTimeout = setTimeout(() => {
    clearPasskeyPolling();
    const modalVisible = $('#modalPasskeyPairing').modal('is active');
    if (modalVisible) {
      $.toast({ class: 'warning', message: 'Se agotó el tiempo de espera de la passkey. Revisa el estado de la conexión.' });
    }
  }, 60000);
}

function populateInstances(instances) {
  const tableBody = $('#instances-body');
  const cardsContainer = $('#instances-cards'); // Assuming you have a container for cards
  tableBody.empty();
  cardsContainer.empty();
  const currentInstance = getLocalStorageItem('currentInstance');

  if(instances.length==0) {
    const nodatarow = '<tr><td style="text-align:center;" colspan=6>No hay instancias</td></tr>'
    tableBody.append(nodatarow);
  }
  instances.forEach((instance, idx) => {

  const row = `
      <tr>
        <td>${instance.id}</td>
        <td>${instance.name}</td>
        <td><i class="fas ${instance.connected ? 'fa-check wsp-ok' : 'fa-xmark wsp-no'}"></i> <span class="status ${instance.connected}">${instance.connected ? 'Sí' : 'No'}</span></td>
        <td><i class="fas ${instance.loggedIn ? 'fa-check wsp-ok' : 'fa-xmark wsp-no'}"></i> <span class="status ${instance.loggedIn}">${instance.loggedIn ? 'Sí' : 'No'}</span></td>
        <td>${instanceProxyLabel(instance)}</td>
        <td>
          <button class="box-btn dashboard-button" onclick="openDashboard('${instance.id}', '${instance.token}')">
            <i class="fas fa-arrow-up-right-from-square"></i> Abrir
          </button>
          <button class="box-btn box-btn-danger negative dashboard-button" onclick="deleteInstance('${instance.id}')">
            <i class="fas fa-trash-can"></i> Eliminar
          </button>
        </td>
      </tr>
  `;
  tableBody.append(row);

  const card = `
      <div class="wsp-instancia hidden no-hover" id="instance-card-${instance.id}">
          <div class="content">
              <div class="wsp-grid wsp-apilable">
                  <!-- Left Column - Instance Info -->
                  <div class="wsp-col">
                      <div class="header" style="font-size: 1.3em; margin-bottom: 0.5rem;">
                          ${instance.name}
                          <div class="wsp-etiquetas" style="margin-top: 0.5em;">
                              <div class="box-badge ${instance.connected ? 'box-badge-success' : 'box-badge-danger'}">
                                  <i class="fas ${instance.connected ? 'fa-check' : 'fa-xmark'}"></i>
                                  ${instance.connected ? 'Conectado' : 'Desconectado'}
                              </div>
                              <div class="box-badge ${instance.loggedIn ? 'box-badge-success' : 'box-badge-danger'}">
                                  <i class="fas ${instance.loggedIn ? 'fa-check' : 'fa-xmark'}"></i>
                                  ${instance.loggedIn ? 'Sesión iniciada' : 'Sesión cerrada'}
                              </div>
                          </div>
                      </div>
                      
                      <div class="meta" style="margin-bottom: 1rem;">ID de la instancia: ${instance.id}</div>
                      
                      <div class="wsp-lista">
                          <div class="item">
                              <div class="header">Token</div>
                              <div class="content" style="word-break: break-all;">${instance.token}</div>
                          </div>
                          <div class="item">
                              <div class="header">JID</div>
                              <div class="content">${instance.jid || 'No disponible'}</div>
                          </div>
                          <div class="item">
                              <div class="header">Webhook</div>
                              <div class="content" style="word-break: break-all;">${instance.webhook || 'Sin configurar'}</div>
                          </div>
                          <div class="item">
                              <div class="header">HMAC</div>
                              <div class="content">${instance.hmac_configured ? 'Configurado' : 'Sin configurar'}</div>
                          </div>
                          <div class="item">
                              <div class="header">Eventos suscritos</div>
                              <div class="content">${instance.events || 'Sin configurar'}</div>
                          </div>
                          <div class="item">
                              <div class="header">Historial de mensajes</div>
                              <div class="content">${instance.history || 0} mensajes por chat</div>
                          </div>
                          <div class="item">
                              <div class="header">Proxy</div>
                              <div class="content">${instance.proxy_config.enabled ? 'Activado' : 'Desactivado'}</div>
                          </div>
                          <div class="item">
                              <div class="header">URL del proxy</div>
                              <div class="content">${instance.proxy_config.proxy_url || 'Sin configurar'}</div>
                          </div>
                          ${instance.proxy_pool_id ? `
                          <div class="item">
                              <div class="header">Pool de proxies</div>
                              <div class="content">
                                  ${instanceProxyLabel(instance)}
                                  ${getLocalStorageItem('isAdmin') && !instance.connected ? `<button class="box-btn box-btn-sm" onclick="releaseProxyPool('${instance.id}')" title="Libera este lugar del pool; se asignará un proxy de nuevo en la próxima conexión">Release</button>` : ''}
                              </div>
                          </div>` : ''}
                          <div class="item">
                              <div class="header">Proxy del webhook</div>
                              <div class="content">${instance.proxy_config.webhook_use_proxy === false ? 'Sin proxy' : 'Con proxy'}</div>
                          </div>
                          <div class="item">
                              <div class="header">S3</div>
                              <div class="content">${instance.s3_config.enabled ? 'Activado' : 'Desactivado'}</div>
                          </div>
                          <div class="item">
                              <div class="header">Endpoint de S3</div>
                              <div class="content">${instance.s3_config.endpoint || 'Sin configurar'}</div>
                          </div>
                      </div>
                  </div>
                  
                  <!-- Right Column - QR Code / Passkey (only shown if not logged in) -->
                  ${!instance.loggedIn ? `
                  <div class="wsp-col" style="display: flex; flex-direction: column; justify-content: center; align-items: center;">
                      ${instance.passkeyPending && instance.publicKey ? `
                      <!-- Passkey Mode -->
                      <div class="wsp-seccion" style="width: 100%; max-width: 300px; text-align: center;">
                        <i class="key" style="font-size: 3em; color: #f2711c;"></i>
                        <h4 class="wsp-titulo">Se requiere passkey</h4>
                        <p style="font-size: 12px; color: #666;">
                          WhatsApp requested passkey verification.
                        </p>
                        <button class="box-btn passkey-setup-btn" data-passkey-index="${idx}">
                          <i class="fas fa-key"></i> Configurar passkey
                        </button>
                      </div>
                      ` : `
                      <!-- QR Code Mode -->
                      <div class="wsp-seccion" style="width: 100%; max-width: 200px; height: 200px; display: flex; justify-content: center; align-items: center;">
                        ${instance.qrcode ? 
                          `<img src="${instance.qrcode}" style="max-height: 100%; max-width: 100%;">
                      </div>
                      <div>
                        Abre WhatsApp en tu teléfono y toca<br/><i class="fas fa-ellipsis-vertical"></i>> Dispositivos vinculados > Vincular un dispositivo.
                          ` : 
                                `<div class="wsp-titulo" style="text-align: center;">
                                    <i class="qrcode" style="font-size: 3em;"></i>
                                    <div class="sub header">El código QR aparecerá aquí</div>
                                </div>`
                           }
                      </div>
                      `}
                    </div>
                    ` : `
                    <!--one column when no qr to display-->
                    `}
                </div>
            </div>
            
            <div class="extra content">
              <button class="box-btn positive dashboard-button ${instance.connected === true ? 'hidden' : ''}" id="button-connect-${instance.id}" onclick="connect('${instance.token}')">Conectar</button>
              <button class="box-btn box-btn-danger negative dashboard-button ${instance.connected === true ? '' : 'hidden'}" id="button-logout-${instance.id}" onclick="logout('${instance.token}')">Cerrar sesión</button>
              <button class="box-btn positive dashboard-button ${instance.connected === true && instance.loggedIn === false ? '' : 'hidden'}" id="button-pair-${instance.id}" onclick="modalPairPhone()">Iniciar con código de emparejamiento</button>
              </div>
        </div>
        `;
    cardsContainer.append(card);
  });
  if(currentInstance!==null) {
     const showInstanceId=`instance-card-${currentInstance}`
     $('#'+showInstanceId).removeClass('hidden');
     
     // Store current instance data globally for use in modals
     const currentInstanceObj = instances.find(inst => inst.id === currentInstance);
     if (currentInstanceObj) {
       currentInstanceData = currentInstanceObj;
     }
  }

  // Bind passkey setup buttons
  document.querySelectorAll('.passkey-setup-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const idx = parseInt(this.getAttribute('data-passkey-index'), 10);
      const pk = instances[idx] && instances[idx].publicKey;
      if (pk) showPasskeyModal(pk);
    });
  });
}

/**
 * Set an item in localStorage with expiry time (in hours)
 * @param {string} key - Key to store under
 * @param {*} value - Value to store
 * @param {number} hours - Expiry time in hours (default: 1 hour)
 */
function setLocalStorageItem(key, value, hours = 1) {
  const now = new Date();
  const expiryTime = now.getTime() + hours * 60 * 60 * 1000; // Convert hours to milliseconds

  const item = {
    value: value,
    expiry: expiryTime,
  };

  localStorage.setItem(key, JSON.stringify(item));
}

/**
 * Get an item from localStorage. Returns null if expired or not found.
 * @param {string} key - Key to retrieve
 * @returns {*|null} - Stored value or null
 */
function getLocalStorageItem(key) {
  const itemStr = localStorage.getItem(key);
  if (!itemStr) return null;

  try {
    const item = JSON.parse(itemStr);
    const now = new Date().getTime();

    // Check if expired (only if the parsed item has an expiry property)
    if (item.expiry && now > item.expiry) {
      localStorage.removeItem(key); // Clean up expired item
      return null;
    }

    // Return value only if the parsed item has a value property
    return item.value !== undefined ? item.value : null;
  } catch (e) {
    // If JSON parsing fails, treat it as not found
    return null;
  }
}

/**
 * Remove an item from localStorage
 * @param {string} key - Key to remove
 */
function removeLocalStorageItem(key) {
  localStorage.removeItem(key);
}

/**
 * Clear all localStorage items (with or without expiry)
 */
function clearLocalStorage() {
  localStorage.clear();
}

function showAdminUser() {
  const indicator = document.getElementById('user-role-indicator');
  const text = document.getElementById('user-role-text');
  
  indicator.className = 'item admin';
  indicator.innerHTML = `
    <i class="fas fa-user-shield"></i>
    <div class="box-badge">ADMIN</div>
  `;
}
  
function showRegularUser() {
  const indicator = document.getElementById('user-role-indicator');
  const text = document.getElementById('user-role-text');
  
  indicator.className = 'item user';
  indicator.innerHTML = `
    <i class="fas fa-user"></i>
    <div class="box-badge">USER</div>
  `;
}

// Configuración de S3 Functions
async function loadS3Config() {
  // Check if we have instance data available (admin viewing specific instance)
  if (currentInstanceData && currentInstanceData.s3_config) {
    const s3Config = currentInstanceData.s3_config;
    const hasConfig = s3Config.enabled || s3Config.endpoint || s3Config.bucket;
    
    $('#s3Endpoint').val(s3Config.endpoint || '');
    $('#s3AccessKey').val(s3Config.access_key === '***' ? '' : s3Config.access_key || '');
    $('#s3SecretKey').val(''); // Never show secret key
    $('#s3Bucket').val(s3Config.bucket || '');
    $('#s3Region').val(s3Config.region || '');
    $('#s3ForcePathStyle').prop('checked', s3Config.path_style || false);
    $('#s3PublicUrl').val(s3Config.public_url || '');
    
    // Media delivery dropdown
    $('#s3MediaDelivery').dropdown('set selected', s3Config.media_delivery || 'base64');
    
    // Retention days
    $('#s3RetentionDays').val(s3Config.retention_days || 30);
    
    // Show/hide delete button based on whether config exists
    if (hasConfig) {
      $('#deleteS3Config').show();
    } else {
      $('#deleteS3Config').hide();
    }
    
    return;
  }
  
  // Fallback to API call for regular users or when instance data is not available
  const token = getLocalStorageItem('token');
  const myHeaders = new Headers();
  myHeaders.append('token', token);
  
  try {
    const res = await fetch(baseUrl + "/session/s3/config", {
      method: "GET",
      headers: myHeaders
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.code === 200 && data.data) {
        const hasConfig = data.data.enabled || data.data.endpoint || data.data.bucket;
        
        $('#s3Endpoint').val(data.data.endpoint || '');
        $('#s3AccessKey').val(data.data.access_key === '***' ? '' : data.data.access_key);
        $('#s3SecretKey').val(''); // Never show secret key
        $('#s3Bucket').val(data.data.bucket || '');
        $('#s3Region').val(data.data.region || '');
        $('#s3ForcePathStyle').prop('checked', data.data.path_style || false);
        $('#s3PublicUrl').val(data.data.public_url || '');
        
        // Media delivery dropdown
        $('#s3MediaDelivery').dropdown('set selected', data.data.media_delivery || 'base64');
        
        // Retention days
        $('#s3RetentionDays').val(data.data.retention_days || 30);
        
        // Show/hide delete button based on whether config exists
        if (hasConfig) {
          $('#deleteS3Config').show();
        } else {
          $('#deleteS3Config').hide();
        }
      } else {
        // No config found, hide delete button and set defaults
        $('#deleteS3Config').hide();
        $('#s3Endpoint').val('');
        $('#s3AccessKey').val('');
        $('#s3SecretKey').val('');
        $('#s3Bucket').val('');
        $('#s3Region').val('');
        $('#s3ForcePathStyle').prop('checked', false);
        $('#s3PublicUrl').val('');
        $('#s3MediaDelivery').dropdown('set selected', 'base64');
        $('#s3RetentionDays').val(30);
      }
    }
  } catch (error) {
    console.error('Error loading S3 config:', error);
    $('#deleteS3Config').hide();
  }
}

async function saveS3Config() {
  const token = getLocalStorageItem('token');
  const myHeaders = new Headers();
  myHeaders.append('token', token);
  myHeaders.append('Content-Type', 'application/json');
  
  const config = {
    enabled: true,
    endpoint: $('#s3Endpoint').val().trim(),
    access_key: $('#s3AccessKey').val().trim(),
    secret_key: $('#s3SecretKey').val().trim(),
    bucket: $('#s3Bucket').val().trim(),
    region: $('#s3Region').val().trim(),
    path_style: $('#s3ForcePathStyle').is(':checked'),
    public_url: $('#s3PublicUrl').val().trim(),
    media_delivery: $('#s3MediaDelivery').val() || 'base64',
    retention_days: parseInt($('#s3RetentionDays').val()) || 30
  };
  
  try {
    const res = await fetch(baseUrl + "/session/s3/config", {
      method: "POST",
      headers: myHeaders,
      body: JSON.stringify(config)
    });
    
    const data = await res.json();
    if (data.success) {
      showSuccess('Configuración de S3 guardada');
      // Show delete button since we now have a configuration
      $('#deleteS3Config').show();
      $('#modalS3Config').modal('hide');
    } else {
      showError('No se guardó la configuración de S3: ' + (data.error || 'Error desconocido'));
    }
  } catch (error) {
    showError('Error al guardar la configuración de S3');
    console.error('Error:', error);
  }
}

async function testS3Connection() {
  const token = getLocalStorageItem('token');
  const myHeaders = new Headers();
  myHeaders.append('token', token);
  
  // Show loading state
  $('#testS3Connection').addClass('loading disabled');
  
  try {
    const res = await fetch(baseUrl + "/session/s3/test", {
      method: "POST",
      headers: myHeaders
    });
    
    const data = await res.json();
    if (data.success) {
      showSuccess('La conexión con S3 funciona');
    } else {
      showError('Falló la prueba de conexión con S3: ' + (data.error || 'Error desconocido'));
    }
  } catch (error) {
    showError('Error al probar la conexión con S3');
    console.error('Error:', error);
  } finally {
    $('#testS3Connection').removeClass('loading disabled');
  }
}

async function deleteS3Config() {
  // Show confirmation dialog
  if (!confirm('¿Seguro que quieres eliminar la configuración de S3? Esta acción no se puede deshacer.')) {
    return;
  }
  
  const token = getLocalStorageItem('token');
  const myHeaders = new Headers();
  myHeaders.append('token', token);
  
  // Show loading state
  $('#deleteS3Config').addClass('loading disabled');
  
  try {
    const res = await fetch(baseUrl + "/session/s3/config", {
      method: "DELETE",
      headers: myHeaders
    });
    
    const data = await res.json();
    if (data.success) {
      showSuccess('Configuración de S3 eliminada');
      
      // Clear all form fields
      $('#s3Endpoint').val('');
      $('#s3AccessKey').val('');
      $('#s3SecretKey').val('');
      $('#s3Bucket').val('');
      $('#s3Region').val('');
      $('#s3ForcePathStyle').prop('checked', false);
      $('#s3PublicUrl').val('');
      $('#s3MediaDelivery').dropdown('set selected', 'base64');
      $('#s3RetentionDays').val(30);
      
      // Hide delete button
      $('#deleteS3Config').hide();
      
      $('#modalS3Config').modal('hide');
    } else {
      showError('No se eliminó la configuración de S3: ' + (data.error || 'Error desconocido'));
    }
  } catch (error) {
    showError('Error al eliminar la configuración de S3');
    console.error('Error:', error);
  } finally {
    $('#deleteS3Config').removeClass('loading disabled');
  }
}

// Configuración del historial Functions
async function loadHistoryConfig() {
  const token = getLocalStorageItem('token');
  const myHeaders = new Headers();
  myHeaders.append('token', token);
  
  try {
    // Get user status to check proxy_config
    const res = await fetch(baseUrl + "/session/status", {
      method: "GET",
      headers: myHeaders
    });
    
    if (res.ok) {
      const data = await res.json();
      $('#historySyncDays').val(data.data?.days_to_sync_history ?? 0);
      if (data.code === 200 && data.data && data.data.history) {
        const historyConfig = data.data.history;
        $('#history').val(historyConfig);
        
      } else {
        $('#history').val('0');
      }
    }
  } catch (error) {
    console.error('Error loading history config:', error);
  }
}

async function saveHistoryConfig() {
  const token = getLocalStorageItem('token');
  const myHeaders = new Headers();
  myHeaders.append('token', token);
  myHeaders.append('Content-Type', 'application/json');
  
  const historyConfig = Number($('#history').val());
  const syncDays = Number($('#historySyncDays').val());
  if (!Number.isInteger(historyConfig) || historyConfig < 0 ||
      !Number.isInteger(syncDays) || syncDays < 0 || syncDays > 365) {
    showError('El historial debe ser un entero mayor o igual a 0 y los días de sincronización deben estar entre 0 y 365.');
    return;
  }
  
  const config = {
    history: historyConfig,
    days_to_sync_history: syncDays,
  };
  
  try {
    const res = await fetch(baseUrl + "/session/history", {
      method: "POST",
      headers: myHeaders,
      body: JSON.stringify(config)
    });
    
    const data = await res.json();
    if (data.success) {
      showSuccess('Historial guardado. Los días de sincronización se aplican en el próximo emparejamiento.');
      $('#modalHistoryConfig').modal('hide');
    } else {
      showError('No se guardó la configuración del historial: ' + (data.error || 'Error desconocido'));
    }
  } catch (error) {
    showError('Error al guardar la configuración del historial');
    console.error('Error:', error);
  }
}

// Configuración del proxy Functions
async function loadProxyConfig() {
  const token = getLocalStorageItem('token');
  const myHeaders = new Headers();
  myHeaders.append('token', token);
  
  try {
    // Get user status to check proxy_config
    const res = await fetch(baseUrl + "/session/status", {
      method: "GET",
      headers: myHeaders
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.code === 200 && data.data && data.data.proxy_config) {
        const proxyConfig = data.data.proxy_config;
        const proxyUrl = proxyConfig.proxy_url || '';
        const enabled = proxyConfig.enabled || false;
        const webhookUseProxy = proxyConfig.webhook_use_proxy !== false;
        
        // Set checkbox state
        $('#proxyEnabled').prop('checked', enabled);
        $('#proxyEnabledToggle').checkbox(enabled ? 'set checked' : 'set unchecked');
        
        // Set proxy URL
        $('#proxyUrl').val(proxyUrl);

        $('#proxyWebhookUseProxy').prop('checked', webhookUseProxy);
        $('#proxyWebhookUseProxyToggle').checkbox(webhookUseProxy ? 'set checked' : 'set unchecked');
        
        // Show/hide URL field based on enabled state
        if (enabled) {
          $('#proxyUrlField').addClass('show');
          $('#proxyWebhookUseProxyField').addClass('show');
        } else {
          $('#proxyUrlField').removeClass('show');
          $('#proxyWebhookUseProxyField').removeClass('show');
        }
      } else {
        // No proxy config, set defaults
        $('#proxyEnabled').prop('checked', false);
        $('#proxyEnabledToggle').checkbox('set unchecked');
        $('#proxyUrl').val('');
        $('#proxyUrlField').removeClass('show');
        $('#proxyWebhookUseProxy').prop('checked', true);
        $('#proxyWebhookUseProxyToggle').checkbox('set checked');
        $('#proxyWebhookUseProxyField').removeClass('show');
      }
    }
  } catch (error) {
    console.error('Error loading proxy config:', error);
  }
}

async function saveProxyConfig() {
  const token = getLocalStorageItem('token');
  const myHeaders = new Headers();
  myHeaders.append('token', token);
  myHeaders.append('Content-Type', 'application/json');
  
  const enabled = $('#proxyEnabled').is(':checked');
  const proxyUrl = $('#proxyUrl').val().trim();
  const webhookUseProxy = $('#proxyWebhookUseProxy').is(':checked');
  
  // If proxy is disabled, send disable request
  if (!enabled) {
    const config = {
      enable: false,
      proxy_url: '',
      webhook_use_proxy: webhookUseProxy
    };
    
    try {
      const res = await fetch(baseUrl + "/session/proxy", {
        method: "POST",
        headers: myHeaders,
        body: JSON.stringify(config)
      });
      
      const data = await res.json();
      if (data.success) {
        showSuccess('Proxy desactivado');
        $('#modalProxyConfig').modal('hide');
      } else {
        showError('No se desactivó el proxy: ' + (data.error || 'Error desconocido'));
      }
    } catch (error) {
      showError('Error al desactivar el proxy');
      console.error('Error:', error);
    }
    return;
  }
  
  // If enabled, validate proxy URL
  if (!proxyUrl) {
    showError('La URL del proxy es obligatoria si el proxy está activado');
    return;
  }
  
  // Validate proxy URL has correct protocol
  if (!proxyUrl.startsWith('http://') && !proxyUrl.startsWith('https://') && !proxyUrl.startsWith('socks5://')) {
    showError('La URL del proxy debe empezar con http://, https:// o socks5://');
    return;
  }
  
  const config = {
    enable: true,
    proxy_url: proxyUrl,
    webhook_use_proxy: webhookUseProxy
  };
  
  try {
    const res = await fetch(baseUrl + "/session/proxy", {
      method: "POST",
      headers: myHeaders,
      body: JSON.stringify(config)
    });
    
    const data = await res.json();
    if (data.success) {
      showSuccess('Configuración del proxy guardada');
      $('#modalProxyConfig').modal('hide');
    } else {
      showError('No se guardó la configuración del proxy: ' + (data.error || 'Error desconocido'));
    }
  } catch (error) {
    showError('Error al guardar la configuración del proxy');
    console.error('Error:', error);
  }
}

// Configuración HMAC Functions
async function loadHmacConfig() {
  const token = getLocalStorageItem('token');
  const myHeaders = new Headers();
  myHeaders.append('token', token);
  
  try {
    const res = await fetch(baseUrl + "/session/hmac/config", {
      method: "GET",
      headers: myHeaders
    });
    
    if (res.ok) {
      const hmacConfig = await res.json();
      
      $('#hmacKey').val(hmacConfig.hmac_key === '***' ? '' : hmacConfig.hmac_key);
      
      if (hmacConfig.hmac_key === '***') {
        $('#deleteHmacConfig').show();
      } else {
        $('#deleteHmacConfig').hide();
      }
    } else {
      // No config found or error
      $('#deleteHmacConfig').hide();
      $('#hmacKey').val('');
    }
  } catch (error) {
    console.error('Error loading HMAC config:', error);
    $('#deleteHmacConfig').hide();
    $('#hmacKey').val('');
  }
}

async function saveHmacConfig() {
  const token = getLocalStorageItem('token');
  const myHeaders = new Headers();
  myHeaders.append('token', token);
  myHeaders.append('Content-Type', 'application/json');
  
  const hmacKey = $('#hmacKey').val().trim();
  
  if (!hmacKey) {
    showError('La clave HMAC es obligatoria');
    return;
  }
  
  if (hmacKey.length < 32) {
    showError('La clave HMAC debe tener al menos 32 caracteres');
    return;
  }
  
  const config = {
    hmac_key: hmacKey
  };
  
  try {
    const res = await fetch(baseUrl + "/session/hmac/config", {
      method: "POST",
      headers: myHeaders,
      body: JSON.stringify(config)
    });
    
    const response = await res.json();
    
    if (res.ok && response.Details) {
      showSuccess('Configuración HMAC guardada');
      $('#deleteHmacConfig').show();
      $('#modalHmacConfig').modal('hide');
    } else {
      showError('No se guardó la configuración HMAC: ' + (response.error || 'Error desconocido'));
    }
  } catch (error) {
    showError('Error al guardar la configuración HMAC');
    console.error('Error:', error);
  }
}

async function deleteHmacConfig() {
  // Show confirmation dialog
  if (!confirm('¿Seguro que quieres eliminar la configuración HMAC? Esta acción no se puede deshacer.')) {
    return;
  }
  
  const token = getLocalStorageItem('token');
  const myHeaders = new Headers();
  myHeaders.append('token', token);
  
  // Show loading state
  $('#deleteHmacConfig').addClass('loading disabled');
  
  try {
    const res = await fetch(baseUrl + "/session/hmac/config", {
      method: "DELETE",
      headers: myHeaders
    });
    
    const response = await res.json();
    
    // This endpoint returns Details directly, without a success wrapper.
    if (res.ok && response.Details) {
      showSuccess('Configuración HMAC eliminada');
      
      // Clear form field
      $('#hmacKey').val('');
      
      // Hide delete button
      $('#deleteHmacConfig').hide();
      
      $('#modalHmacConfig').modal('hide');
    } else {
      showError('No se eliminó la configuración HMAC: ' + (response.error || 'Error desconocido'));
    }
  } catch (error) {
    showError('Error al eliminar la configuración HMAC');
    console.error('Error:', error);
  } finally {
    $('#deleteHmacConfig').removeClass('loading disabled');
  }
}

function generateRandomHmacKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  $('#hmacKey').val(result);
}

function toggleHmacKeyVisibility() {
  const input = $('#hmacKey');
  const showBtn = $('#showHmacKey');
  const hideBtn = $('#hideHmacKey');
  
  if (input.attr('type') === 'password') {
    input.attr('type', 'text');
    showBtn.hide();
    hideBtn.show();
  } else {
    input.attr('type', 'password');
    showBtn.show();
    hideBtn.hide();
  }
}

// HMAC Instance Functions
function generateRandomHmacKeyInstance() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  $('input[name="hmac_key"]').val(result);
}

function toggleHmacKeyVisibilityInstance() {
  const input = $('input[name="hmac_key"]');
  const showBtn = $('#showHmacKeyInstance');
  const hideBtn = $('#hideHmacKeyInstance');
  
  if (input.attr('type') === 'password') {
    input.attr('type', 'text');
    showBtn.hide();
    hideBtn.show();
  } else {
    input.attr('type', 'password');
    showBtn.show();
    hideBtn.hide();
  }
}

// Invalidate previous results when the account changes or the modal reopens.
let businessProfileRequest = 0;
function resetBusinessProfile() {
  businessProfileRequest++;
  const container = document.getElementById('businessProfileContainer');
  container.textContent = '';
  container.classList.add('hidden');
  const button = document.getElementById('getBusinessProfile');
  button.disabled = false;
  button.classList.remove('loading');
}

function appendProfileField(container, label, value) {
  const row = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = label + ': ';
  row.appendChild(title);
  row.appendChild(document.createTextNode(value || 'No indicado'));
  container.appendChild(row);
}

function renderBusinessProfile(container, profile) {
  container.textContent = '';
  appendProfileField(container, 'Account', profile.JID);
  appendProfileField(container, 'Dirección', profile.Address);
  appendProfileField(container, 'Correo', profile.Email);
  appendProfileField(container, 'Business hours timezone', profile.BusinessHoursTimeZone);
  for (const [label, value] of [['Categorías', profile.Categories], ['Detalles del perfil', profile.ProfileOptions], ['Business hours', profile.BusinessHours]]) {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = label;
    const pre = document.createElement('pre');
    pre.style.whiteSpace = 'pre-wrap';
    pre.textContent = JSON.stringify(value || (label === 'Detalles del perfil' ? {} : []), null, 2);
    details.appendChild(summary);
    details.appendChild(pre);
    container.appendChild(details);
  }
}

async function doBusinessProfile() {
  const phone = document.getElementById('userinfoinput').value.trim();
  const container = document.getElementById('businessProfileContainer');
  const button = document.getElementById('getBusinessProfile');
  const request = ++businessProfileRequest;
  container.classList.remove('hidden');
  if (!/^\+?\d+(?:@(s\.whatsapp\.net|lid))?$/.test(phone)) {
    container.textContent = 'Ingresa un número internacional o un JID individual (PN/LID).';
    return;
  }
  button.disabled = true;
  button.classList.add('loading');
  container.textContent = 'Buscando el perfil de negocio…';
  try {
    const response = await fetch(baseUrl + '/user/business-profile', {
      method: 'POST',
      headers: {token: getLocalStorageItem('token'), 'Content-Type': 'application/json'},
      body: JSON.stringify({Phone: phone})
    });
    const result = await response.json();
    if (request !== businessProfileRequest) return;
    if (!response.ok || !result.success || !result.data) {
      container.textContent = `Perfil de negocio no disponible: ${result.error || 'No se devolvió ningún perfil'}`;
      return;
    }
    renderBusinessProfile(container, result.data);
  } catch (error) {
    if (request === businessProfileRequest) container.textContent = 'No se pudo obtener el perfil de negocio. Inténtalo de nuevo.';
  } finally {
    if (request === businessProfileRequest) {
      button.disabled = false;
      button.classList.remove('loading');
    }
  }
}
