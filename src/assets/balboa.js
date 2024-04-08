import { ref } from 'vue';

export const balboaToken = ref(null);
let device_id = null;
let deviceConfiguration = null;

// Button mappings for the Balboa API
const BUTTON_MAP = {
  //add normal operation 0x01
  NormalOperation: 1,
  SoakMode: 29, //all pumps off
  HoldMode: 60,
  TempRange: 80,
  HeatMode: 81,  
  pumps: {
    1: 4, // Pump 1 maps to Balboa API Button #4
    2: 5, // Pump 2 maps to Balboa API Button #5
    3: 6, // Pump 3 maps to Balboa API Button #6
    4: 7, // Pump 4 maps to Balboa API Button #7
    5: 8, // Pump 5 maps to Balboa API Button #8
    6: 9, // Pump 6 maps to Balboa API Button #9
  },
  lights: {
    1: 17, // Light 1 maps to Balboa API Button #17
    2: 18, // Light 2 maps to Balboa API Button #18
  },
  auxs: {
    1: 22, // Aux 1 maps to Balboa API Button #22
    2: 23, // Aux 2 maps to Balboa API Button #23
  },
  blower: 12, // Blower maps to Balboa API Button #12
  mister: 14, // Mister maps to Balboa API Button #14
};

export function updateUserData(data) {
  balboaToken.value = data.token;
  device_id = data.device.device_id;
}

//HELPERS
export function decode(message) {
  message = atob(
    new TextDecoder("iso-8859-1").decode(new TextEncoder().encode(message))
  );
  return Array.from(message, (char) => char.charCodeAt(0));
}

export function encode(array) {
  let message = array.map((code) => String.fromCharCode(code)).join("");
  message = btoa(message);
  return new TextDecoder("iso-8859-1").decode(
    new TextEncoder().encode(message)
  );
}

export function calculateChecksum(data) {
  let crc = 0xb5;
  data.concat([0]).forEach((d) => {
    for (let i = 0; i < 8; i++) {
      let bit = crc & 0x80;
      crc = ((crc << 1) & 0xff) | ((d >> (7 - i)) & 0x01);
      if (bit) crc ^= 0x07;
    }
  });
  return crc ^ 0x02;
}

//FUNCTIONS
export async function login(username, password) {
  const API_URL = 'https://bwgapi.balboawater.com/users/login';
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch');
    }

    const data = await response.json();
    balboaToken.value = data.token;
    device_id = data.device.device_id;

    return data;
  } catch (error) {
    console.error(error);
  }
}

// Function to send a message to the balboa with fetch with options and body with default null
async function makeSciRequest(body = null) {
  // Check if token exists
  if (!balboaToken.value) {
    throw new Error("No token found");
  }

  const url = `https://bwgapi.balboawater.com/devices/sci`;

  // Set up fetch options
  const options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${balboaToken.value}`,
      "Content-Type": "application/xml",
    },
    body: body,
  };

  // Make the request and handle potential errors
  const response = await fetch(url, options);
  if (!response.ok) {
    //if error 401, token is expired set to null
    if (response.status === 401) {
      balboaToken.value = null;
    }
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }

  // Check if response is JSON and parse accordingly
  const contentType = response.headers.get("content-type");
  return contentType && contentType.includes("application/json")
    ? response.json()
    : response.text();
}

function extractValueFromXMLResponse(response, targetName) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(response, "text/xml");
  const value = xmlDoc.querySelector(targetName)?.textContent;

  if (!value) {
    //extract target error
    const error = xmlDoc.querySelector("error")?.textContent;
    if (error) {
      console.error(`Failed to extract ${targetName} from XML response: ${error}`);
      throw new Error(`Failed to extract ${targetName} from XML response: ${error}`);
    }
    throw new Error(`Failed to extract ${targetName} from XML response`);
  }

  return value;
}

// Fetch system information and parse it
export async function getSystemInformation(parsed = true) {
  try {
    const response = await makeSciRequest(
      `<sci_request version="1.0"><file_system><targets><device id="${device_id}"/></targets><commands><get_file path="SystemInformation.txt"/></commands></file_system></sci_request>`
    );
    const value = extractValueFromXMLResponse(response, "data");
    const decodedValue = decode(value);
    if (!parsed) {
      return decodedValue;
    }
    return parseSystemInformation(decodedValue.slice(4));
  } catch (error) {
    console.error(`Failed to get system information: ${error}`);
    throw error; // re-throw the error so it can be handled by the caller
  }
}

// Parse system information from data
export function parseSystemInformation(data) {
  try {
    return {
      softwareId: `M${data[0]}_${data[1]} V${data[2]}.${data[3]}`,
      modelName: String.fromCharCode(...data.slice(4, 12)).trim(),
      currentSetup: data[12],
      configurationSignature: data.slice(13, 17).map(byte => byte.toString(16)).join(''),
      voltage: data[17] === 0x01 ? 240 : null,
      heaterType: data[18] === 0x0A ? 'standard' : 'unknown',
      dipSwitch: `${data[19].toString(2).padStart(8, '0')}${data[20].toString(2).padStart(8, '0')}`,
      systemInformationLoaded: true
    };
  } catch (error) {
    console.error(`Failed to parse system information: ${error}`);
    throw error; // re-throw the error so it can be handled by the caller
  }
}

// Function to get setup parameters
export async function getSetupParameters(parsed = true) {
  try {
    const xmlRequestBody = `<sci_request version="1.0"><file_system cache="false"><targets><device id="${device_id}" /></targets><commands><get_file path="SetupParameters.txt" /></commands></file_system></sci_request>`;
    const response = await makeSciRequest(xmlRequestBody);

    if (!response) {
      console.error("No response from setup parameters");
      throw new Error("No response");
    }

    const value = extractValueFromXMLResponse(response, "data");
    const decodedValue = decode(value);
    if (!parsed) {
      return decodedValue;
    }
    return parseSetupParameters(decodedValue);
  } catch (error) {
    console.error(error);
  }
}

// Function to parse setup parameters
export function parseSetupParameters(data) {
  return {
    lowRange: {
      min: data[6], // Low range minimum temperature in °F
      max: data[7]  // Low range maximum temperature in °F
    },
    highRange: {
      min: data[8], // High range minimum temperature in °F
      max: data[9]  // High range maximum temperature in °F
    },
    pumpCounter: data[11], // Pump counter (add the number of "1"s from bit)
  };
}
//FILTER CYCLES
export async function getFilterCycles(parsed = true) {
  const xmlRequestBody = `<sci_request version="1.0"><data_service><targets><device id="${device_id}"/></targets><requests><device_request target_name="Request">Filters</device_request></requests></data_service></sci_request>`;
  const response = await makeSciRequest(xmlRequestBody);
  const value = extractValueFromXMLResponse(response, "device_request");
  const decodedValue = decode(value);
  if (!parsed) {
    return decodedValue;
  }
  return parseFilterCycles(decodedValue);
}

export async function setFilterCycles(cycles) {
  const encodedValue = encode(cycles);
  const xmlRequestBody = `<sci_request version="1.0"><data_service><targets><device id="${device_id}"/></targets><requests><device_request target_name="Filters">${encodedValue}</device_request></requests></data_service></sci_request>`;
  return await makeSciRequest(xmlRequestBody);
}

export function parseFilterCycles(data) {
  return {
    1: {
      id: 1,
      startHours: data[4],
      startMinutes: data[5],
      durationHours: data[6],
      durationMinutes: data[7],
      active: true,
    },
    2: {
      id: 2,
      startHours: data[8] % 128,
      startMinutes: data[9],
      durationHours: data[10],
      durationMinutes: data[11],
      active: data[8] > 127,
      switchable: true,
    },
  };
}

export function generateFilterCyclesArray(cycles) {
  const data = [
    13,
    10,
    191,
    35,
    cycles[1].startHours,
    cycles[1].startMinutes,
    cycles[1].durationHours,
    cycles[1].durationMinutes,
    cycles[2].active ? 128 + cycles[2].startHours : cycles[2].startHours,
    cycles[2].startMinutes,
    cycles[2].durationHours,
    cycles[2].durationMinutes,
  ];
  const checksum = calculateChecksum(data);
  data.push(checksum);
  return data;
}


//PANEL DATA
export async function getPanelData(parsed = true) {
  try {
    const xmlRequestBody = `<sci_request version="1.0"><file_system><targets><device id="${device_id}"/></targets><commands><get_file path="PanelUpdate.txt"/></commands></file_system></sci_request>`;
    const response = await makeSciRequest(xmlRequestBody);

    if (!response) {
      throw new Error("No response from panel data");
    }

    const value = extractValueFromXMLResponse(response, "data");
    const decodedValue = decode(value);

    if (!parsed) {
      return decodedValue;
    }
    
    const parsedValue = await parsePanelData(decodedValue);
    return parsedValue;
  } catch (error) {
    console.error(error);
    throw error;
  }
}


// This function is used to parse the panel data.
export async function parsePanelData(data) {
  // Check if deviceConfiguration is null
  if(!deviceConfiguration){
    try {
      // Fetch device configuration if not already available
      deviceConfiguration = await getDeviceConfiguration();
    } catch (error) {
      console.error('Error fetching device configuration:', error);
      throw error;
    }
  }

  // Define constant maps for heat modes, filter modes, status, and wifi status
  const heatModes = { 0: "Ready", 1: "Rest", 2: "Ready in Rest" };
  const filterModes = { 4: "Filter 1", 8: "Filter 2", 12: "Filter 1 & 2", 0: "Off" };
  const statusMap = { 4: "Low", 8: "Medium", 12: "High" };
  const wifiStatusMap = { 0: "WiFi OK", 16: "WiFi Spa Not Communicating", 32: "WiFi Startup", 48: "WiFi prime", 64: "WiFi hold", 80: "WiFi panel" };

  // Construct the panel data object
  const panelData = {
    spaState: data[4] === 0 ? "Running" : data[4] === 1 ? "Initializing" : data[4] === 5 ? "Hold Mode" : data[4] === 20 ? "A/B Temps ON" : data[4] === 23 ? "Test Mode" : "Unknown",
    is24HourTime: (data[13] & 2) !== 0,
    hours: data[7],
    minutes: data[8],
    isCelsius: (data[13] & 1) !== 0,
    temperature: (data[13] & 1) === 0 || data[6] === 255 ? data[6] : data[6] / 2,
    targetTemperature: (data[13] & 1) !== 0 ? data[24] / 2 : data[24],
    heating: {
      state: (data[14] & 48) !== 0,
      status: (data[14] & 48) === 0 ? "Off" : data[15] === 2 ? "High heat" : "Low heat",
    },
    circPump: {
      state: data[15] >= 1 || data[16] >= 1 || (data[17] & 3) >= 1,
      status: data[15] < 1 && data[16] < 1 && (data[17] & 3) < 1 ? "Off" : (data[14] & 48) === 0 ? "Low" : "Low heat",
      present: deviceConfiguration.circPump.present
    },
    range: {
      state: (data[14] & 4) !== 0,
      status: (data[14] & 4) !== 0 ? "High Range" : "Low Range",
    },
    holdMode: {
      state:data[4] === 5,
      duration: data[4] === 5 ? data[11] : null,
    },
    heatMode: heatModes[data[9]] || "None",
    filterMode: {
      state: {
        1: (data[13] & 4) !== 0,
        2: (data[13] & 8) !== 0,
      },
      status: filterModes[data[13] & 12] || "Off"
    },
    pumpStates: {
      1: {
        id: 1,
        state: data[15] !== 2 ? false : true,
        status: data[15] === 1 ? data[14] === 0 ? "Low" : "Low heat" : data[15] === 2 ? data[14] === 0 ? "High" : "High heat" : "Off",
        present: deviceConfiguration.pumps[1].present,
      },
      ...Array.from({length: 5}, (_, i) => i + 2).reduce((pumps, i) => {
        const pumpState = ["off", "low", "high"][(data[15] >> ((i - 1) * 2)) & 3];
        pumps[i] = {
          id: i,
          state: pumpState !== "off",
          status: pumpState,
          present: deviceConfiguration.pumps[i].present,
        };
        return pumps;
      }, {}),
    },
    lightStates: {
      1: {
        id: 1,
        state: (data[18] & 3) !== 0,
        status: (data[18] & 3) !== 0 ? "On" : "Off",
        present: deviceConfiguration.lights[1].present,
      },
      2: {
        id: 2,
        state: (data[18] & 12) !== 0,
        status: (data[18] & 12) !== 0 ? "On" : "Off",
        present: deviceConfiguration.lights[2].present,
      },
    },
    blowerState: {
      state: (data[17] & 12) !== 0,
      status: statusMap[data[17] & 12] || "Off",
      present: deviceConfiguration.blower.present,
    },
    misterState: {
      state: (data[19] & 1) !== 0,
      status: (data[19] & 1) !== 0 ? "On" : "Off",
      present: deviceConfiguration.mister.present,
    },
    auxStates: {
      1: {
        id: 1,
        state: (data[19] & 8) !== 0,
        status: (data[19] & 8) !== 0 ? "On" : "Off",
        present: deviceConfiguration.auxs[1].present,
      },
      2: {
        id: 2,
        state: (data[19] & 16) !== 0,
        status: (data[19] & 16) !== 0 ? "On" : "Off",
        present: deviceConfiguration.auxs[2].present,
      },
    },
    wifiState: wifiStatusMap[data[20]],
  };

  // Return the parsed panel data
  return panelData;
}

// This function is used to get the device configuration.
export async function getDeviceConfiguration(parsed = true) {
  // Create the XML request body
  const xmlRequestBody = `<sci_request version="1.0"><file_system><targets><device id="${device_id}"/></targets><commands><get_file path="DeviceConfiguration.txt"/></commands></file_system></sci_request>`;
  
  // Make the SCI request
  const response = await makeSciRequest(xmlRequestBody);
  
  // If there's no response, throw an error
  if (!response) {
    throw new Error("No response from device configuration");
  }
  
  // Extract the value from the XML response
  const value = extractValueFromXMLResponse(response, "data");
  
  // Decode the value
  const decodedValue = decode(value);
  
  if (!parsed) {
    return decodedValue;
  }
  // Parse the device configuration
  const parsedValue = parseDeviceConfiguration(decodedValue);
  
  // Return the parsed value
  return parsedValue;
}

// This function is used to parse the device configuration.
export function parseDeviceConfiguration(data) {
  // Define the device configuration
  const deviceConfiguration = {
    circPump: { id: 0, present: (data[7] & 128) !== 0 },
    pumps: {
      1: { id: 1, present: (data[4] & 3) !== 0 },
      2: { id: 2, present: (data[4] & 12) !== 0 },
      3: { id: 3, present: (data[4] & 48) !== 0 },
      4: { id: 4, present: (data[4] & 192) !== 0 },
      5: { id: 5, present: (data[5] & 3) !== 0 },
      6: { id: 6, present: (data[5] & 12) !== 0 },
    },
    lights: {
      1: { id: 1, present: (data[6] & 3) !== 0 },
      2: { id: 2, present: (data[6] & 12) !== 0 },
    },
    blower: { present: (data[7] & 15) !== 0 },
    auxs: {
      1: { id: 1, present: (data[8] & 1) !== 0 },
      2: { id: 2, present: (data[8] & 2) !== 0 },
    },
    mister: { present: (data[8] & 16) !== 0 },
  };
  
  // Return the device configuration
  return deviceConfiguration;
}

// This function is used to generate the SCI XML for a button.
function generateButtonSciXML(data) {
  // Return the SCI XML
  return `<sci_request version="1.0"><data_service><targets><device id="${device_id}"/></targets><requests><device_request target_name="Button">${data}</device_request></requests></data_service></sci_request>`;
}

// This function is used to update the state of a pump.
export async function updatePumpState(pumpId, state) {
  // Get the button for the pump
  const pumpButton = BUTTON_MAP.pumps[pumpId];
  
  // If there's no button for the pump, throw an error
  if (!pumpButton) {
    throw new Error("Invalid pump id");
  }
  
  // Get the current panel data
  const currentPanelData = await getPanelData();
  
  // If there's no panel data, throw an error
  if (!currentPanelData) {
    throw new Error("No panel data");
  }
  
  // Get the current state of the pump
  const currentPumpState = currentPanelData.pumpStates[pumpId];
  
  // Define the state string
  const stateString = state ? "on" : "off";
  
  // If the state is already the desired state, return a message
  if (state === currentPumpState.state) {
    return "Pump already in that state";
  }

  // Generate the body data
  const bodyData = `${pumpButton}:${stateString}`;
  
  // Generate the XML request body
  const xmlRequestBody = generateButtonSciXML(bodyData);
  
  // Make the SCI request
  const response = await makeSciRequest(xmlRequestBody);
  
  // Return the response
  return response;
}

// This function is used to update the state of a light.
export async function updateLightState(lightId, state) {
  // Get the button for the light
  const lightButton = BUTTON_MAP.lights[lightId];
  
  // If there's no button for the light, throw an error
  if (!lightButton) {
    throw new Error("Invalid light id");
  }
  
  // Get the current panel data
  const currentPanelData = await getPanelData();
  
  // If there's no panel data, throw an error
  if (!currentPanelData) {
    throw new Error("No panel data");
  }
  
  // Get the current state of the light
  const currentLightState = currentPanelData.lightStates[lightId];
  
  // Define the state string
  const stateString = state ? "on" : "off";
  
  // If the state is already the desired state, return a message
  if (state === currentLightState.state) {
    return "Light already in that state";
  }

  // Generate the body data
  const bodyData = `${lightButton}:${stateString}`;
  
  // Generate the XML request body
  const xmlRequestBody = generateButtonSciXML(bodyData);
  
  // Make the SCI request
  const response = await makeSciRequest(xmlRequestBody);
  
  // Return the response
  return response;
}

// This function is used to update the state of an auxiliary device.
export async function updateAuxState(auxId, state) {
  // Get the button for the auxiliary device
  const auxButton = BUTTON_MAP.auxs[auxId];
  
  // If there's no button for the auxiliary device, throw an error
  if (!auxButton) {
    throw new Error("Invalid aux id");
  }
  
  // Get the current panel data
  const currentPanelData = await getPanelData();
  
  // If there's no panel data, throw an error
  if (!currentPanelData) {
    throw new Error("No panel data");
  }
  
  // Get the current state of the auxiliary device
  const currentAuxState = currentPanelData.auxStates[auxId];
  
  // Define the state string
  const stateString = state ? "on" : "off";
  
  // If the state is already the desired state, return a message
  if (state === currentAuxState.state) {
    return "Aux already in that state";
  }

  // Generate the body data
  const bodyData = `${auxButton}:${stateString}`;
  
  // Generate the XML request body
  const xmlRequestBody = generateButtonSciXML(bodyData);
  
  // Make the SCI request
  const response = await makeSciRequest(xmlRequestBody);
  
  // Return the response
  return response;
}

// This function is used to update the state of the blower.
export async function updateBlowerState(state) {
  // Get the current panel data
  const currentPanelData = await getPanelData();
  
  // If there's no panel data, throw an error
  if (!currentPanelData) {
    throw new Error("No panel data");
  }
  
  // Get the current state of the blower
  const currentBlowerState = currentPanelData.blowerState;
  
  // Define the state string
  const stateString = state ? "on" : "off";
  
  // If the state is already the desired state, return a message
  if (state === currentBlowerState.state) {
    return "Blower already in that state";
  }

  // Generate the body data
  const bodyData = `${BUTTON_MAP.blower}:${stateString}`;
  
  // Generate the XML request body
  const xmlRequestBody = generateButtonSciXML(bodyData);
  
  // Make the SCI request
  const response = await makeSciRequest(xmlRequestBody);
  
  // Return the response
  return response;
}

// This function is used to update the state of the mister.
export async function updateMisterState(state) {
  // Get the current panel data
  const currentPanelData = await getPanelData();
  
  // If there's no panel data, throw an error
  if (!currentPanelData) {
    throw new Error("No panel data");
  }
  
  // Get the current state of the mister
  const currentMisterState = currentPanelData.misterState;
  
  // Define the state string
  const stateString = state ? "on" : "off";
  
  // If the state is already the desired state, return a message
  if (state === currentMisterState.state) {
    return "Mister already in that state";
  }

  // Generate the body data
  const bodyData = `${BUTTON_MAP.mister}:${stateString}`;
  
  // Generate the XML request body
  const xmlRequestBody = generateButtonSciXML(bodyData);
  
  // Make the SCI request
  const response = await makeSciRequest(xmlRequestBody);
  
  // Return the response
  return response;
}

// This function is used to set the temperature.
export async function setTemperature(temperature) {
  // Get the current panel data
  const currentPanelData = await getPanelData();
  
  // If there's no panel data, throw an error
  if (!currentPanelData) {
    throw new Error("No panel data");
  }
  
  // If the temperature is already the desired temperature, return a message
  if (temperature === currentPanelData.temperature) {
    return "Temperature already set to that value";
  }
  
  // If the panel data is in Celsius, convert the temperature to Fahrenheit
  if (currentPanelData.isCelsius) {
    temperature = temperature * 2;
  }

  // Generate the XML request body
  const xmlRequestBody = `<sci_request version="1.0"><data_service><targets><device id="${device_id}"/></targets><requests><device_request target_name="SetTemp">${temperature}</device_request></requests></data_service></sci_request>`;
  
  // Make the SCI request
  const response = await makeSciRequest(xmlRequestBody);
  
  // Return the response
  return response;
}

// This function is used to set the temperature range.
export async function setTemperatureRange(rangeHigh) {
  // Get the current panel data
  const currentPanelData = await getPanelData();
  
  // If there's no panel data, throw an error
  if (!currentPanelData) {
    throw new Error("No panel data");
  }
  
  // Get the current range
  const currentRange = currentPanelData.range;
  
  // If the range is already the desired range, return a message
  if (rangeHigh === currentRange.state) {
    return "Temperature range already set to that value";
  }

  // Generate the XML request body
  const xmlRequestBody = generateButtonSciXML(BUTTON_MAP.TempRange);
  
  // Make the SCI request
  const response = await makeSciRequest(xmlRequestBody);
  
  // Return the response
  return response;
}

// This function is used to set the hold mode.
export async function setHoldMode(setToHold) {
  // Get the current panel data
  const currentPanelData = await getPanelData();
  
  // If there's no panel data, throw an error
  if (!currentPanelData) {
    throw new Error("No panel data");
  }
  
  // If the hold mode is already the desired mode, return a message
  // if ((setToHold && currentPanelData.spaState === "Hold Mode") || (!setToHold && currentPanelData.spaState !== "Hold Mode")) {
  //   return "Hold mode already set to that value";
  // }

  // Generate the XML request body
  const xmlRequestBody = generateButtonSciXML(currentPanelData.holdMode.state ? BUTTON_MAP.NormalOperation : BUTTON_MAP.HoldMode);
  
  // Make the SCI request
  const response = await makeSciRequest(xmlRequestBody);
  
  // Return the response
  return response;
}

// This function is used to set the heat mode.
export async function setHeatMode(setToReady) {
  // Get the current panel data
  const currentPanelData = await getPanelData();
  
  // If there's no panel data, throw an error
  if (!currentPanelData) {
    throw new Error("No panel data");
  }
  
  // Get the current heat mode
  const currentHeatMode = currentPanelData.heatMode;
  
  // If the heat mode is already the desired mode, return a message
  if ((setToReady && currentHeatMode === "Ready") || (!setToReady && currentHeatMode === "Rest")) {
    return "Heat mode already set to that value";
  }

  // Generate the XML request body
  const xmlRequestBody = generateButtonSciXML(BUTTON_MAP.HeatMode);
  
  // Make the SCI request
  const response = await makeSciRequest(xmlRequestBody);
  
  // Return the response
  return response;
}

// This function is used to set the system time.
export async function setSystemTime(hours, minutes) {
  // Generate the XML request body
  const xmlRequestBody = `<sci_request version="1.0"><data_service><targets><device id="${device_id}"/></targets><requests><device_request target_name="SystemTime">${hours}:${minutes}</device_request></requests></data_service></sci_request>`;
  
  // Make the SCI request
  const response = await makeSciRequest(xmlRequestBody);
  
  // Return the response
  return response;
}

// This function is used to set the time format.
export async function setTimeFormat(is24HourTime) {
  // Generate the XML request body
  const xmlRequestBody = `<sci_request version="1.0"><data_service><targets><device id="${device_id}"/></targets><requests><device_request target_name="TimeFormat">${is24HourTime ? 24 : 12}</device_request></requests></data_service></sci_request>`;
  
  // Make the SCI request
  const response = await makeSciRequest(xmlRequestBody);
  
  // Return the response
  return response;
}

// This function is used to set the temperature units.
export async function setTempUnits(isCelsius) {
  // Generate the XML request body
  const xmlRequestBody = `<sci_request version="1.0"><data_service><targets><device id="${device_id}"/></targets><requests><device_request target_name="TempUnits">${isCelsius ? "C" : "F"}</device_request></requests></data_service></sci_request>`;
  
  // Make the SCI request
  const response = await makeSciRequest(xmlRequestBody);
  
  // Return the response
  return response;
}

// This function is used to convert Fahrenheit to Celsius.
export function farenheitToCelsius(farenheit) {
  // Convert Fahrenheit to Celsius to the nearest 0.5
  return Math.round((farenheit - 32) / 1.8 * 2) / 2;
}
