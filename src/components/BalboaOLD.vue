
<template>
  <h1>BALBOA HOT TUB</h1>
  <div v-if="!auth.authorized">
    <h2>Authorization</h2>
    <input type="text" v-model="auth.username" placeholder="Username" />
    <input type="password" v-model="auth.password" placeholder="Password" />
    <button @click="loginAndGetToken(auth.username, auth.password)">Login</button>
  </div>


  <div v-else-if="panelDataRef && deviceConfigRef">
    <div>
      <h2>Logged in as: {{ auth.username }}</h2>
      
      <button @click="logout()">LOGOUT</button>
    </div>
    <div>
      <button @click="refreshData()" style="background-color: rgb(83, 104, 228); margin-bottom: 2rem;">REFRESH</button>
    </div>

    <button @click="getFilterCycles()">GET Filter Cycles</button>

    <div>
      Current Time: {{ panelDataRef.currentTimeHour }}:{{ panelDataRef.currentTimeMinute }}
    </div>
    <div>
      Temperature: {{ panelDataRef.actualTemperature }}°{{ panelDataRef.temperatureScale }}
    </div>
    <div>
      Target Temperature: {{ panelDataRef.targetTemperature }}°{{ panelDataRef.temperatureScale }}
      <div v-if="panelDataRef.targetTemperature">
        <input type="range" step="0.5" :min="panelDataRef.heatingMode === 'high' ? 26.5 : 10" :max="panelDataRef.heatingMode === 'high' ? 40 : 37" v-model="panelDataRef.targetTemperature" />

        <input type="number" step="0.5" :min="panelDataRef.heatingMode === 'high' ? 26.5 : 10" :max="panelDataRef.heatingMode === 'high' ? 40 : 37" v-model="panelDataRef.targetTemperature" />

        <button @click="updateTemperature(auth.device_id, panelDataRef.targetTemperature)">Update</button>
      </div>
    </div>
    <div>
      Heating: {{ panelDataRef.isHeating ? 'On' : 'Off' }}
    </div>
    <div>
      Heating Range: {{ panelDataRef.heatingMode }}
    </div>
    <div>
      Heat Mode: {{ panelDataRef.heatMode }}
    </div>
    <div>
      Filter Mode: {{ panelDataRef.filterMode }}
    </div>
    <div v-for="pump in myPumps" :key="pump">
      {{ pump }}:
      <button
        @click="updatePumpStatus(auth.device_id, parseInt(pump.match(/\d+/)[0]), !onORoff(panelDataRef.pumpsState[pump]))">
        {{ panelDataRef.pumpsState[pump] }}</button>
    </div>

    <div v-for="light in myLights">
      {{ light }}:
      <button
        @click="updateLightStatus(auth.device_id, parseInt(light.match(/\d+/)[0]), !onORoff(panelDataRef.lightsState[light]))">{{
          panelDataRef.lightsState[light] }}</button>

    </div>

    <div v-for="blower in myBlower">
      {{ blower }}:
      <button @click="updateBlowerStatus(auth.device_id, !onORoff(panelDataRef.blowerState))">{{
        panelDataRef.blowerState }}</button>
    </div>

    <div v-if="myAuxs.length > 0">
      <label>Auxs</label>
      {{ myAuxs }}
    </div>

    <div>
      WiFi: {{ panelDataRef.wifiState }}
    </div>


    <div hidden>
      <h2>Panel Data</h2>
      <pre>{{ panelDataRef }}</pre>

      <h2>Device Configuration</h2>
      <pre>{{ deviceConfigRef }}</pre>
    </div>
  </div>
  <div v-else>
    <h2>Loading...</h2>
  </div>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue'

const auth = ref({
  authorized: false,
  token: null,
  device_id: null,
  username: null,
  password: null
})

const panelDataRef = ref(null)
const deviceConfigRef = ref(null)

const myPumps = computed(() => {
  const pumps = deviceConfigRef.value?.Pumps || {};
  return Object.keys(pumps).filter(pump => pumps[pump].present && panelDataRef.value?.pumpsState[pump]);
})

const myLights = computed(() => {
  const lights = deviceConfigRef.value?.Lights || {};
  return Object.keys(lights).filter(light => lights[light].present);
})

const myBlower = computed(() => {
  return deviceConfigRef.value?.Blower?.present ? ['Blower'] : [];
})

const myAuxs = computed(() => {
  const auxs = deviceConfigRef.value?.Aux || {};
  return Object.keys(auxs).filter(aux => auxs[aux].present);
})


const exampleData = {
  deviceConfig: {
    "Pumps": {
      "Pump0": {
        "present": true
      },
      "Pump1": {
        "present": true
      },
      "Pump2": {
        "present": false
      },
      "Pump3": {
        "present": false
      },
      "Pump4": {
        "present": false
      },
      "Pump5": {
        "present": false
      },
      "Pump6": {
        "present": false
      }
    },
    "Lights": {
      "Light1": {
        "present": true
      },
      "Light2": {
        "present": false
      }
    },
    "Blower": {
      "present": true
    },
    "Aux": {
      "Aux1": {
        "present": false
      },
      "Aux2": {
        "present": false
      }
    },
    "Mister": {
      "present": false
    }
  },
  panelData: {
    "is24HourTime": true,
    "currentTimeHour": 16,
    "currentTimeMinute": 2,
    "temperatureScale": "C",
    "actualTemperature": 35,
    "targetTemperature": 35,
    "isHeating": false,
    "heatingMode": "low",
    "heatMode": "Ready",
    "pumpsState": {
      "Pump1": "off",
      "Pump2": "off",
      "Pump3": "off",
      "Pump4": "off",
      "Pump5": "off",
      "Pump6": "off"
    },
    "lightsState": {
      "Light1": "off",
      "Light2": "off"
    },
    "blowerState": "off",
    "misterState": "off",
    "auxState": {
      "Aux1": "off",
      "Aux2": "off"
    },
    "wifiState": "WiFi OK"
  }
}

onMounted(async () => {
  refreshData()
})

async function refreshData() {
  const storedBalboaSession = JSON.parse(sessionStorage.getItem('balboaSession'));

  console.log('storedBalboaSession', storedBalboaSession);
  if (storedBalboaSession?.token && storedBalboaSession?.device.device_id) {
    auth.value.authorized = true;
    auth.value.username = storedBalboaSession.username;
    auth.value.token = storedBalboaSession.token;
    auth.value.device_id = storedBalboaSession.device.device_id;
  } else {
    auth.value.authorized = false;
    auth.value.token = null;
    auth.value.device_id = null;
  }

  await handleDeviceConfigurationRequest(auth.value.device_id)
  await handlePanelUpdateRequest(auth.value.device_id)
}

function onORoff(value) {
  return value === 'off' ? false : true
}

function httpsRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    console.log('httpsRequest', options, body);
    const url = `https://${options.hostname}${options.path}`
    fetch(url, {
      method: options.method,
      headers: options.headers,
      body: body
    }).then(response => {
      if (!response.ok) {
        reject(new Error('Failed to fetch'));
      }
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json();
      } else {
        return response.text();
      }
    }).then(data => {
      resolve(data);
    }).catch(error => {
      reject(error);
    });
  });
}

async function logout(){
  sessionStorage.removeItem("balboaSession");
  auth.value.authorized = false;
  auth.value.token = null;
  auth.value.device_id = null;
  return;
}

// Function to login and retrieve token
async function loginAndGetToken(username, password) {
  // Define request options
  const loginOptions = {
    hostname: 'bwgapi.balboawater.com',
    path: '/users/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  };

  // Stringify login data
  const loginData = JSON.stringify({ username, password });

  try {
    // Perform login request
    const loginResponse = await httpsRequest(loginOptions, loginData);
    // Store token and device ID in sessionStorage
    sessionStorage.setItem('balboaSession', JSON.stringify(loginResponse));
    refreshData()
    return loginResponse;
  } catch (error) {
    console.error('Login Error:', error.message);
    throw error;
  }
}

// Function to parse device configuration data
function parseDeviceConfigurationData(encodedData) {
  const decoded = decode(encodedData);

  console.log('Decoded Device Configuration:', decoded);

  let deviceConfig = {
    Pumps: {},
    Lights: {},
    Blower: {},
    Aux: {},
    Mister: {}
  };

  // Parse and store data for each pump
  deviceConfig.Pumps = {
    Pump0: { present: (decoded[7] & 128) !== 0 },
    Pump1: { present: (decoded[4] & 3) !== 0 },
    Pump2: { present: (decoded[4] & 12) !== 0 },
    Pump3: { present: (decoded[4] & 48) !== 0 },
    Pump4: { present: (decoded[4] & 192) !== 0 },
    Pump5: { present: (decoded[5] & 3) !== 0 },
    Pump6: { present: (decoded[5] & 12) !== 0 }
  };

  // Parse and store data for lights
  deviceConfig.Lights = {
    Light1: { present: (decoded[6] & 3) !== 0 },
    Light2: { present: (decoded[6] & 12) !== 0 }
  };

  // Parse and store data for blower (adjust the logic as needed)
  deviceConfig.Blower = { present: (decoded[7] & 15) !== 0 }; // Example logic

  // Parse and store data for Aux (adjust the logic as needed)
  deviceConfig.Aux = {
    Aux1: { present: (decoded[8] & 1) !== 0 },
    Aux2: { present: (decoded[8] & 2) !== 0 }
  };

  // Parse and store data for Mister (adjust the logic as needed)
  deviceConfig.Mister = { present: (decoded[8] & 16) !== 0 };

  return deviceConfig;
}



// Function to extract data from XML
function extractDataFromXML(xmlString) {
  const dataRegex = /<data>(.*?)<\/data>/;
  const match = xmlString.match(dataRegex);
  return match ? match[1] : null;
}

function decode(message) {
  message = new TextDecoder("iso-8859-1").decode(new TextEncoder().encode(message));
  message = atob(message);

  let output = [];
  // output[0] = 126;
  let max = message.length;
  for (let i = 0; i < max; i++) {
    output.push(message.charCodeAt(i));
  }
  return output;
}

function encode(array) {
    let message = '';
    for (let i = 0; i < array.length; i++) {
        message += String.fromCharCode(array[i]);
    }
    message = btoa(message);
    message = new TextDecoder("iso-8859-1").decode(new TextEncoder().encode(message));
    return message;
}

// Function to parse Panel Data

function parsePanelData(encodedData) {
  // Decode the base64 encoded data
  const decoded = decode(encodedData);
  console.log('Decoded Panel Data:', decoded);

  // Validate SPA byte array
  if (!isValidSpaByteArray(decoded)) {
    console.error("BWA Cloud Spa Error: Encoded data is not valid SPA panel data. Is the Spa Online?");
    return false;
  }

  // Parse common data
  const is24HourTime = (decoded[13] & 2) !== 0;
  const currentTimeHour = decoded[7];
  const currentTimeMinute = decoded[8];
  const temperatureScale = (decoded[13] & 1) === 0 ? "F" : "C";
  const actualTemperature = temperatureScale === "C" ? decoded[6] / 2 : decoded[6];
  const targetTemperature = temperatureScale === "C" ? decoded[24] / 2 : decoded[24];
  const isHeating = (decoded[14] & 48) !== 0;
  const heatingMode = (decoded[14] & 4) === 4 ? "high" : "low";

  // Determine heat mode
  let heatMode;
  switch (decoded[9]) {
    case 0: heatMode = "Ready"; break;
    case 1: heatMode = "Rest"; break;
    case 2: heatMode = "Ready in Rest"; break;
    default: heatMode = "None";
  }

  // Determine filterMode
  let filterMode;
  switch ((decoded[13] & 12)) {
    case 4: filterMode = "Filter 1"; break;
    case 8: filterMode = "Filter 2"; break;
    case 12: filterMode = "Filter 1 & 2"; break;
    case 0:
    default: filterMode = "off";
  }

  // Pumps state parsing
  let pumpsState = {};
  for (let i = 1; i <= 6; i++) {
    let pumpState = "off";
    switch (decoded[15] & (3 << ((i - 1) * 2))) {
      case 1 << ((i - 1) * 2): pumpState = "low"; break;
      case 2 << ((i - 1) * 2): pumpState = "high"; break;
    }
    pumpsState[`Pump${i}`] = pumpState;
  }

  // Lights state parsing
  let lightsState = {
    Light1: (decoded[18] & 3) !== 0 ? "on" : "off",
    Light2: (decoded[18] & 12) !== 0 ? "on" : "off"
  };

  // Blower state parsing
  let blowerState = "off";
  switch (decoded[17] & 12) {
    case 4: blowerState = "low"; break;
    case 8: blowerState = "medium"; break;
    case 12: blowerState = "high"; break;
  }

  // Mister state parsing
  let misterState = (decoded[19] & 1) !== 0 ? "on" : "off";

  // Aux state parsing
  let auxState = {
    Aux1: (decoded[19] & 8) !== 0 ? "on" : "off",
    Aux2: (decoded[19] & 16) !== 0 ? "on" : "off"
  };

  // WiFi state parsing
  let wifiState = "Unknown"; // Default state
  switch (decoded[16] & 240) {
    case 0: wifiState = "WiFi OK"; break;
    case 16: wifiState = "WiFi Spa Not Communicating"; break;
    case 32: wifiState = "WiFi Startup"; break;
    // ... other cases as per your system's specification
  }

  // Parsed panel data
  const panelData = {
    is24HourTime,
    currentTimeHour,
    currentTimeMinute,
    temperatureScale,
    actualTemperature,
    targetTemperature,
    isHeating,
    heatingMode,
    heatMode,
    filterMode,
    pumpsState,
    lightsState,
    blowerState,
    misterState,
    auxState,
    wifiState
  };
  // Iterate over panelData and set tags, including the check for actualTemperature
  for (const [key, value] of Object.entries(panelData)) {
    if (typeof value === 'object') {
      for (const [subKey, subValue] of Object.entries(value)) {
        // Check if the current key is 'actualTemperature'
        if (`${key}_${subKey}` === 'actualTemperature' && subValue === 127.5) {
          tag(`${key}_${subKey}`, 38); // Update to 38 if the condition is met
        } else {
          tag(`${key}_${subKey}`, subValue); // Set normally for other cases
        }
      }
    } else {
      // Check if the current key is 'actualTemperature'
      if (key === 'actualTemperature' && value === 127.5) {
        tag(key, 38); // Update to 38 if the condition is met
      } else {
        tag(key, value); // Set normally for other cases
      }
    }
  }

  /*

  // Set each piece of data as a global variable
  for (const [key, value] of Object.entries(panelData)) {
      if (typeof value === 'object') {
          // For nested objects, set each sub-property as a separate global variable
          for (const [subKey, subValue] of Object.entries(value)) {
              //global.set(`${key}_${subKey}`, subValue);
              tag(`${key}_${subKey}`, subValue);
          }
      } else {
          // For simple properties, set directly
          //global.set(key, value);
          tag(key, value);
          //console.log(key, value);
      }
  }
*/

  // Return the parsed panel data
  return panelData;
  return {
    is24HourTime,
    currentTimeHour,
    currentTimeMinute,
    temperatureScale,
    actualTemperature,
    targetTemperature,
    isHeating,
    heatingMode,
    heatMode,
    pumpsState,
    lightsState,
    blowerState,
    misterState,
    auxState,
    wifiState
  };
}

function tag(key, value) {
  // console.log(`Tagged: ${key} - ${value}`);
}

// isValidSpaByteArray function 
function isValidSpaByteArray(decodedData) {
  const VALID_SPA_BYTE_ARRAY = [32, 255, 175]; // Adjusted for JavaScript byte values
  for (let i = 0; i < VALID_SPA_BYTE_ARRAY.length; i++) {
    if (decodedData[i] !== VALID_SPA_BYTE_ARRAY[i]) {
      // return false; //EDITED FIX?????
    }
  }
  return true;
}

// Function to handle the device configuration request
async function handleDeviceConfigurationRequest(deviceId) {
  const requestOptions = createRequestOptions(deviceId, 'DeviceConfiguration.txt');
  try {
    const response = await httpsRequest(requestOptions, createXmlRequestBody(deviceId, 'DeviceConfiguration.txt'));
    const decodedData = parseDeviceConfigurationData(extractDataFromXML(response));
    console.log('Decoded Device Configuration:', decodedData);
    deviceConfigRef.value = decodedData;
  } catch (error) {
    console.error('Device Configuration Request Error:', error.message);
  }
}

// Function to handle the panel update request
async function handlePanelUpdateRequest(deviceId) {
  const requestOptions = createRequestOptions(deviceId, 'PanelUpdate.txt');
  try {
    const response = await httpsRequest(requestOptions, createXmlRequestBody(deviceId, 'PanelUpdate.txt'));
    if (!response) {
      console.error('No response received for panel update request');
      return null;
    }

    const extractedData = extractDataFromXML(response);
    if (!extractedData) {
      console.error('Failed to extract data from XML');
      return null;
    }

    const panelData = parsePanelData(extractedData);
    if (!panelData) {
      console.error('Failed to parse panel data');
      return null;
    }

    panelDataRef.value = panelData;

    console.log('Panel Update Data:', panelData);
    return panelData;

  } catch (error) {
    console.error('Panel Update Request Error:', error.message);
    return null;
  }
}


// Create options for httpsRequest
function createRequestOptions(deviceId, path) {
  return {
    hostname: 'bwgapi.balboawater.com',
    path: '/devices/sci',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${auth.value.token}`,
      'Content-Type': 'application/xml'
    }
  };
}

function extractValueFromResponse(response) {
    // Create a DOMParser object
    const parser = new DOMParser();
    // Parse the response string into a Document object
    const xmlDoc = parser.parseFromString(response, "text/xml");
    
    // Get the value from the XML document
    const value = xmlDoc.querySelector('device_request').textContent;
    
    return value;
}

async function getFilterCycles(deviceId, filterMode) {

const commandXml = `<sci_request version="1.0"><data_service><targets><device id="00000000-00000000-001527FF-FFDB3896"/></targets><requests><device_request target_name="Request">Filters</device_request></requests></data_service></sci_request>`

const requestOptions = {
    hostname: 'bwgapi.balboawater.com',
    path: '/devices/sci',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${auth.value.token}`,
      'Content-Type': 'application/xml'
    }
  };

  try {
    const response = await httpsRequest(requestOptions, commandXml);
    console.log('Filter cycles:', decode(extractValueFromResponse(response)));

  } catch (error) {
    console.error('Error sending command:', error);
  }
}

async function changeFilterCycles(deviceId, filterMode) {

  const commandXml = `<sci_request version="1.0"><data_service><targets><device id="00000000-00000000-001527FF-FFDB3896"/></targets><requests><device_request target_name="Filters">DQq/Iw4tAwAAAAMACg==</device_request></requests></data_service></sci_request>`

const requestOptions = {
      hostname: 'bwgapi.balboawater.com',
      path: '/devices/sci',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${auth.value.token}`,
        'Content-Type': 'application/xml'
      }
    };

    try {
      const response = await httpsRequest(requestOptions, commandXml);
      console.log('Command Response:', response);

      getFilterCycles();

    } catch (error) {
      console.error('Error sending command:', error);
    }
}

// Create XML body for request
function createXmlRequestBody(deviceId, filePath) {
  return `<sci_request version="1.0"><file_system><targets><device id="${deviceId}"/></targets><commands><get_file path="${filePath}"/></commands></file_system></sci_request>`;
}
// SpaControl class integration
class SpaControl {
  constructor(deviceId) {
    this.deviceId = deviceId;
  }

  async sendCommand(buttonNumber, command) {
    const commandXml = this.buildCommandXml(buttonNumber, command);
    console.log(`Sending command: ${command} to button number: ${buttonNumber}`); // Debugging line
    console.log(`Command data: ${command}`); // Log the command data

    const requestOptions = {
      hostname: 'bwgapi.balboawater.com',
      path: '/devices/sci',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${auth.value.token}`,
        'Content-Type': 'application/xml'
      }
    };

    try {
      const response = await httpsRequest(requestOptions, commandXml);
      console.log('Command Response:', response);
    } catch (error) {
      console.error('Error sending command:', error);
    }
  }

  buildCommandXml(targetName, data) {
    // Construct the XML string
    const xml = `<sci_request version="1.0"><data_service><targets><device id="${this.deviceId}"/></targets><requests><device_request target_name="${targetName}">${data}</device_request></requests></data_service></sci_request>`;

    // Log the XML string for debugging
    console.log('Generated XML:', xml);

    return xml;
  }



  async turnOn(buttonNumber) {
    // The command to turn on might have a specific format or data
    await this.sendCommand('Button', buttonNumber + ':on');
  }

  async turnOff(buttonNumber) {
    // The command to turn off might have a specific format or data
    await this.sendCommand('Button', buttonNumber + ':off');
  }
}

//Update the pump
async function updatePumpStatus(deviceId, pumpNumber, turnOn) {
  const pumpButtonMap = {
    1: 4, // Pump 1 maps to Balboa API Button #4
    2: 5, // Pump 2 maps to Balboa API Button #5
    3: 6, // Pump 3 maps to Balboa API Button #6
    4: 7, // Pump 4 maps to Balboa API Button #7
    5: 8, // Pump 5 maps to Balboa API Button #8
    6: 9  // Pump 6 maps to Balboa API Button #9
  };

  const buttonNumber = pumpButtonMap[pumpNumber];
  if (buttonNumber === undefined) {
    console.error('Invalid pump number:', pumpNumber);
    return;
  }

  const currentPanelData = await handlePanelUpdateRequest(deviceId);
  if (!currentPanelData) {
    console.error('Failed to get current panel data');
    return;
  }

  const currentPumpState = currentPanelData.pumpsState[`Pump${pumpNumber}`];
  if ((turnOn && currentPumpState === 'off') || (!turnOn && currentPumpState !== 'off')) {
    const spaControl = new SpaControl(deviceId);
    if (turnOn) {
      await spaControl.turnOn(buttonNumber);
    } else {
      await spaControl.turnOff(buttonNumber);
    }
  } else {
    console.log(`Pump ${pumpNumber} is already in the desired state.`);
  }
}

//Update the lights
async function updateLightStatus(deviceId, lightNumber, turnOn) {
  const lightButtonMap = {
    1: 17, // Light 1 maps to Balboa API Button #17
    2: 18  // Light 2 maps to Balboa API Button #18
  };

  const buttonNumber = lightButtonMap[lightNumber];
  if (buttonNumber === undefined) {
    console.error('Invalid light number:', lightNumber);
    return;
  }

  const currentPanelData = await handlePanelUpdateRequest(deviceId);
  if (!currentPanelData) {
    console.error('Failed to get current panel data');
    return;
  }

  const currentLightState = currentPanelData.lightsState[`Light${lightNumber}`];
  if ((turnOn && currentLightState === 'off') || (!turnOn && currentLightState !== 'off')) {
    const spaControl = new SpaControl(deviceId);
    if (turnOn) {
      await spaControl.turnOn(buttonNumber);
    } else {
      await spaControl.turnOff(buttonNumber);
    }
  } else {
    console.log(`Light ${lightNumber} is already in the desired state.`);
  }
}

//Update the AUX
async function updateAuxStatus(deviceId, auxNumber, turnOn) {
  const auxButtonMap = {
    1: 22, // Aux 1 maps to Balboa API Button #22
    2: 23  // Aux 2 maps to Balboa API Button #23
  };

  const buttonNumber = auxButtonMap[auxNumber];
  if (buttonNumber === undefined) {
    console.error('Invalid auxiliary number:', auxNumber);
    return;
  }

  const currentPanelData = await handlePanelUpdateRequest(deviceId);
  if (!currentPanelData) {
    console.error('Failed to get current panel data');
    return;
  }

  const currentAuxState = currentPanelData.auxState[`Aux${auxNumber}`];
  if ((turnOn && currentAuxState === 'off') || (!turnOn && currentAuxState !== 'off')) {
    const spaControl = new SpaControl(deviceId);
    if (turnOn) {
      await spaControl.turnOn(buttonNumber);
    } else {
      await spaControl.turnOff(buttonNumber);
    }
  } else {
    console.log(`Aux ${auxNumber} is already in the desired state.`);
  }
}

//Update Blower 
async function updateBlowerStatus(deviceId, turnOn) {
  const blowerButtonNumber = 12; // Blower maps to Balboa API Button #12

  const currentPanelData = await handlePanelUpdateRequest(deviceId);
  if (!currentPanelData) {
    console.error('Failed to get current panel data');
    return;
  }

  const currentBlowerState = currentPanelData.blowerState;
  if ((turnOn && currentBlowerState === 'off') || (!turnOn && currentBlowerState !== 'off')) {
    const spaControl = new SpaControl(deviceId);
    if (turnOn) {
      await spaControl.turnOn(blowerButtonNumber);
    } else {
      await spaControl.turnOff(blowerButtonNumber);
    }
  } else {
    console.log('Blower is already in the desired state.');
  }
}

//Update Mister status
async function updateMisterStatus(deviceId, turnOn) {
  const misterButtonNumber = 14; // Mister maps to Balboa API Button #14

  const currentPanelData = await handlePanelUpdateRequest(deviceId);
  if (!currentPanelData) {
    console.error('Failed to get current panel data');
    return;
  }

  const currentMisterState = currentPanelData.misterState;
  if ((turnOn && currentMisterState === 'off') || (!turnOn && currentMisterState !== 'off')) {
    const spaControl = new SpaControl(deviceId);
    if (turnOn) {
      await spaControl.turnOn(misterButtonNumber);
    } else {
      await spaControl.turnOff(misterButtonNumber);
    }
  } else {
    console.log('Mister is already in the desired state.');
  }
}

// Button mappings
const BUTTON_MAP = {
  // ... other mappings ...
  TempRange: 80,
  HeatMode: 81
};

// Function to update the temperature range
async function updateTemperatureRange(deviceId, setToHigh) {
  const tempRangeButtonNumber = BUTTON_MAP.TempRange; // TempRange button number from a map
  const currentPanelData = await handlePanelUpdateRequest(deviceId);

  if (!currentPanelData) {
    console.error('Failed to get current panel data');
    return;
  }

  const currentTempRangeState = currentPanelData.heatingMode.toLowerCase();
  console.log(`Current state: ${currentTempRangeState}, Set to high: ${setToHigh}`);

  // Explicitly check for 'low' or 'high' to ensure case-insensitive comparison
  if (setToHigh && currentTempRangeState === 'low') {
    const spaControl = new SpaControl(deviceId);
    await spaControl.sendCommand('Button', tempRangeButtonNumber.toString());
    console.log(`Temperature range set to high`);
  } else if (!setToHigh && currentTempRangeState === 'high') {
    const spaControl = new SpaControl(deviceId);
    await spaControl.sendCommand('Button', tempRangeButtonNumber.toString());
    console.log(`Temperature range set to low`);
  } else {
    console.log(`Temperature range is already set to ${currentTempRangeState}`);
  }
}









/// Function to update the heat mode
async function updateHeatMode(deviceId, setToReady) {
  const heatModeButtonNumber = BUTTON_MAP.HeatMode; // HeatMode button number from a map
  const currentPanelData = await handlePanelUpdateRequest(deviceId);

  if (!currentPanelData) {
    console.error('Failed to get current panel data');
    return;
  }

  const currentHeatModeState = currentPanelData.heatMode;
  // Corrected logic: Toggle state only if not in the desired state
  if ((setToReady && currentHeatModeState !== 'Ready') || (!setToReady && currentHeatModeState !== 'Rest')) {
    const spaControl = new SpaControl(deviceId);
    await spaControl.sendCommand('Button', heatModeButtonNumber.toString());
    console.log(`Heat mode set to ${setToReady ? 'Ready' : 'Rest'}`);
  } else {
    console.log(`Heat mode is already set to ${currentHeatModeState}`);
  }
}





//Set the temp of the spa
async function updateTemperature(deviceId, newTemperature) {
  const currentPanelData = await handlePanelUpdateRequest(deviceId);
  if (!currentPanelData) {
    console.error('Failed to get current panel data');
    return;
  }

  const temperatureScale = currentPanelData.temperatureScale;
  let convertedTemperature = newTemperature;

  // Convert the new temperature based on the temperature scale
  if (temperatureScale === "C") {
    // If the system is in Celsius, and it expects the setpoint to be double the actual value
    convertedTemperature = newTemperature * 2;
  }

  // Send the command using SpaControl
  const spaControl = new SpaControl(deviceId);
  await spaControl.sendCommand('SetTemp', `${convertedTemperature}`);
  console.log(`Temperature update command sent: ${newTemperature}${temperatureScale} (Converted: ${convertedTemperature})`);

  await handlePanelUpdateRequest(deviceId);
}

async function main(decision) {
  // Check if the decision argument is provided and is a string
  if (typeof decision !== 'string' || decision.split(':').length !== 2) {
    console.error('Invalid or missing decision argument. This script must be run from a Flow with a valid decision string.');
    return;
  }

  try {
    // Check if the token and device ID are available.
    if (!auth.value?.authorized || !auth.value.device_id) {
      // Login and acquire a token.
      //await loginAndGetToken('jozefnad', 'Joseph+3944');
      console.log('Login failed or did not return the expected data.');
      return;
    }

    // Split the decision string to extract the action and the state value
    const [action, stateValue] = decision.split(':');

    // Use a switch statement to handle different actions
    switch (action) {
      case 'configureDevice':
        // Handle device configuration requests.
        await handleDeviceConfigurationRequest(auth.value.device_id);
        break;

      case 'updatePanel':
        // Handle panel update requests.
        await handlePanelUpdateRequest(auth.value.device_id);
        break;

      case 'turnOnPump1':
        // Update pump statuses based on stateValue ('on' or 'off').
        await updatePumpStatus(auth.value.device_id, 1, stateValue === 'on');
        break;

      case 'turnOnPump2':
        // Update pump statuses based on stateValue ('on' or 'off').
        await updatePumpStatus(auth.value.device_id, 2, stateValue === 'on');
        break;

      case 'turnOnLight':
        // Update light statuses based on stateValue ('on' or 'off').
        await updateLightStatus(auth.value.device_id, 1, stateValue === 'on');
        break;

      case 'turnOnBlower':
        // Update blower status based on stateValue ('on' or 'off').
        await updateBlowerStatus(auth.value.device_id, stateValue === 'on');
        break;

      case 'updateHeatMode':
        // Determine the heat mode setting based on stateValue
        let setHeatMode;
        switch (stateValue) {
          case 'Ready':
          case 'Ready in Rest':
            setHeatMode = true;
            break;
          case 'Rest':
            setHeatMode = false;
            break;
          default:
            console.log(`Unknown stateValue: ${stateValue}`);
            return; // Exit if stateValue is not recognized
        }

        // Update heat mode if stateValue is recognized
        await updateHeatMode(auth.value.device_id, setHeatMode);
        break;

      case 'updateTemperatureRange':
        // Update temperature settings based on stateValue ('High' or 'Low').
        const ToHigh = stateValue === 'High';

        await updateTemperatureRange(auth.value.device_id, ToHigh);
        break;



      case 'updateTemperature':
        // Update Target temperature to new temprature.
        await updateTemperature(auth.value.device_id, stateValue);
        break;

      default:
        // Handle invalid decision parameters.
        console.log('Invalid decision parameter.');
        break;
    }
  } catch (error) {
    // Catch and log any errors that occur during execution.
    console.error('Main Function Error:', error.message);
  }
  //global.set('myHomeyScriptVariable', 'Some Value');

}



</script>
<style scoped></style>
