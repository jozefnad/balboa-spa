let balboaToken = null;
let device_id = null;
let deviceConfiguration = null;

// Button mappings for the Balboa API
const BUTTON_MAP = {
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
  balboaToken = data.token;
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
export function login(username, password) {
  return new Promise((resolve, reject) => {
    const url = `https://bwgapi.balboawater.com/users/login`;
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    })
      .then((response) => {
        if (!response.ok) {
          reject(new Error("Failed to fetch"));
        }
        return response.json();
      })
      .then((data) => {
        balboaToken = data.token;
        device_id = data.device.device_id;
        resolve(data);
      })
      .catch((error) => {
        console.error("Error:", error);
        reject(error);
      });
  });
}

//function to send a message to the balboa with fetch with options and body with default null
function makeSciRequest(body = null) {
  return new Promise((resolve, reject) => {
    if (balboaToken === null) {
      reject(new Error("No token found"));
    }
    const url = `https://bwgapi.balboawater.com/devices/sci`;
    fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${balboaToken}`,
        "Content-Type": "application/xml",
      },
      body: body,
    })
      .then((response) => {
        if (!response.ok) {
          reject(new Error("Failed to fetch"));
        }
        // Check if response is JSON
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return response.json();
        } else {
          return response.text();
        }
      })
      .then((data) => {
        resolve(data);
      })
      .catch((error) => {
        reject(error);
      });
  });
}

//SYSTEM INFORMATIONS
export async function getSystemInformation() {
  return new Promise(async (resolve, reject) => {
    const response = await makeSciRequest(
      `<sci_request version="1.0"><file_system><targets><device id="${device_id}"/></targets><commands><get_file path="SystemInformation.txt"/></commands></file_system></sci_request>`
    );
    const value = extractValueFromXMLResponse(response, "data");
    const decodedValue = decode(value);
    const parsedValue = parseSystemInformation(decodedValue.slice(4));
    resolve(parsedValue);
  });
}

export function parseSystemInformation(data) {
  const systemInformation = {
    softwareId: `M${data[0]}_${data[1]} V${data[2]}.${data[3]}`,
    modelName: String.fromCharCode(...data.slice(4, 12)).trim(),
    currentSetup: data[12],
    configurationSignature: data.slice(13, 17).map(byte => byte.toString(16)).join(''),
    voltage: data[17] === 0x01 ? 240 : null,
    heaterType: data[18] === 0x0A ? 'standard' : 'unknown',
    dipSwitch: `${data[19].toString(2).padStart(8, '0')}${data[20].toString(2).padStart(8, '0')}`,
    systemInformationLoaded: true
  };
  return systemInformation;
}


//SETUP PARAMETERS
export async function getSetupParameters() {
  return new Promise(async (resolve, reject) => {
    const xmlRequestBody = `<sci_request version="1.0"><file_system cache="false"><targets><device id="${device_id}" /></targets><commands><get_file path="SetupParameters.txt" /></commands></file_system></sci_request>`;
    const response = await makeSciRequest(xmlRequestBody);
    if (!response) {
      console.log("No response from setup parameters");
      reject(new Error("No response"));
    }
    const value = extractValueFromXMLResponse(response, "data");
    const decodedValue = decode(value);
    const parsedValue = parseSetupParameters(decodedValue);
    resolve(parsedValue);
  });
}

export function parseSetupParameters(data) {
  const setupParameters = {
    lowRange:{
      min: data[6], //low range minimum temperature in °F
      max: data[7]  //low range maximum temperature in °F
    },
    highRange:{
      min: data[8], //high range minimum temperature in °F
      max: data[9]  //high range maximum temperature in °F
    },
    pumpCounter: data[11], //pump counter (add the number of "1"s from bit)
  };
  return setupParameters;
}

//FILTER CYCLES

function extractValueFromXMLResponse(response, targetName) {
  // Create a DOMParser object
  const parser = new DOMParser();
  // Parse the response string into a Document object
  const xmlDoc = parser.parseFromString(response, "text/xml");

  // Get the value from the XML document
  const value = xmlDoc.querySelector(targetName).textContent;

  return value;
}

export async function getFilterCycles() {
  return new Promise(async (resolve, reject) => {
    const response = await makeSciRequest(
      `<sci_request version="1.0"><data_service><targets><device id="${device_id}"/></targets><requests><device_request target_name="Request">Filters</device_request></requests></data_service></sci_request>`
    );
    const value = extractValueFromXMLResponse(response, "device_request");
    const decodedValue = decode(value);
    const parsedValue = parseFilterCycles(decodedValue);
    resolve(parsedValue);
  });
}

export async function setFilterCycles(cycles) {
  return new Promise(async (resolve, reject) => {
    const encodedValue = encode(cycles);
    const xmlRequestBody = `<sci_request version="1.0"><data_service><targets><device id="${device_id}"/></targets><requests><device_request target_name="Filters">${encodedValue}</device_request></requests></data_service></sci_request>`;
    const response = await makeSciRequest(xmlRequestBody);
    resolve(response);
  });
}

export function parseFilterCycles(data) {
  const cycles = {
    filter1: {
      id: 1,
      startHours: data[4],
      startMinutes: data[5],
      durationHours: data[6],
      durationMinutes: data[7],
      active: true,
    },
    filter2: {
      id: 2,
      startHours: data[8] % 128,
      startMinutes: data[9],
      durationHours: data[10],
      durationMinutes: data[11],
      active: data[8] > 127,
      switchable: true,
    },
  };
  return cycles;
}

export function generateFilterCyclesArray(cycles) {
  const data = [
    13,
    10,
    191,
    35,
    cycles.filter1.startHours,
    cycles.filter1.startMinutes,
    cycles.filter1.durationHours,
    cycles.filter1.durationMinutes,
    cycles.filter2.active
      ? 128 + cycles.filter2.startHours
      : cycles.filter2.startHours,
    cycles.filter2.startMinutes,
    cycles.filter2.durationHours,
    cycles.filter2.durationMinutes,
  ];
  const checksum = calculateChecksum(data);
  data.push(checksum);
  return data;
}

//PANEL DATA
export async function getPanelData() {
  return new Promise(async (resolve, reject) => {
    const xmlRequestBody = `<sci_request version="1.0"><file_system><targets><device id="${device_id}"/></targets><commands><get_file path="PanelUpdate.txt"/></commands></file_system></sci_request>`;
    const response = await makeSciRequest(xmlRequestBody);
    if (!response) {
      console.log("No response from panel data");
      reject(new Error("No response"));
    }
    const value = extractValueFromXMLResponse(response, "data");
    const decodedValue = decode(value);
    const parsedValue = parsePanelData(decodedValue);
    resolve(parsedValue);
  });
}

export async function parsePanelData(data) {
  if(deviceConfiguration === null){
    deviceConfiguration = await getDeviceConfiguration();
  }
  const panelData = {
    is24HourTime: (data[13] & 2) !== 0,
    hours: data[7],
    minutes: data[8],
    isCelsius: (data[13] & 1) !== 0,
    //temperature if it is celsius /2 otherwise normal
    temperature: (data[13] & 1) === 0 || data[6] === 255 ? data[6] : data[6] / 2 ,
    targetTemperature: (data[13] & 1) !== 0 ? data[24] / 2 : data[24],
    heating: {
      state: (data[14] & 48) !== 0,
      status: (data[14] & 48) === 0 ? "Off" : data[15] === 2 ? "High heat" : "Low heat",
    },
    circPump: {
      //state if off make false else true
      state: data[15] >= 1 || data[16] >= 1 || (data[17] & 3) >= 1,
      status:
        data[15] < 1 && data[16] < 1 && (data[17] & 3) < 1
          ? "Off"
          : (data[14] & 48) === 0
          ? "Low"
          : "Low heat",
          present: deviceConfiguration.circPump.present
    },
    range: {
      state: (data[14] & 4) !== 0,
      status: (data[14] & 4) !== 0 ? "High Range" : "Low Range",
    },
    heatMode: (() => {
      const heatModes = { 0: "Ready", 1: "Rest", 2: "Ready in Rest" };
      return heatModes[data[9]] || "None";
    })(),
    filterMode: (() => {
      const filterModes = {
        4: "Filter 1",
        8: "Filter 2",
        12: "Filter 1 & 2",
        0: "Off",
      };
      return filterModes[data[13] & 12] || "Off";
    })(),
    pumpStates: {
      1: (() => {
        const state = data[15] !== 2 ? false : true;
        const status =
          data[15] === 1
            ? data[14] === 0
              ? "Low"
              : "Low heat"
            : data[15] === 2
            ? data[14] === 0
              ? "High"
              : "High heat"
            : "Off";
            const present = deviceConfiguration.pumps[1].present;
        return { id: 1, state, status, present };
      })(),
      ...(() => {
        const pumps2to6 = {};
        for (let i = 2; i <= 6; i++) {
          const pumpState = ["off", "low", "high"][
            (data[15] >> ((i - 1) * 2)) & 3
          ];
          pumps2to6[i] = {
            id: i,
            state: pumpState !== "off" ? true : false,
            status: pumpState,
            present: deviceConfiguration.pumps[i].present,
          };
        }
        return pumps2to6;
      })(),
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
    blowerState: (() => {
      const statusMap = { 4: "Low", 8: "Medium", 12: "High" };
      return {
        state: (data[17] & 12) !== 0,
        status: statusMap[data[17] & 12] || "Off",
        present: deviceConfiguration.blower.present,
      };
    })(),
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
    wifiState: (() => {
      const statusMap = {
        0: "WiFi OK",
        16: "WiFi Spa Not Communicating",
        32: "WiFi Startup",
        48: "WiFi prime",
        64: "WiFi hold",
        80: "WiFi panel",
      };
      return statusMap[data[20]];
    })(),
  };
  return panelData;
}

//DEVICE CONFIGURATION
export async function getDeviceConfiguration() {
  return new Promise(async (resolve, reject) => {
    const xmlRequestBody = `<sci_request version="1.0"><file_system><targets><device id="${device_id}"/></targets><commands><get_file path="DeviceConfiguration.txt"/></commands></file_system></sci_request>`;
    const response = await makeSciRequest(xmlRequestBody);
    if (!response) {
      console.log("No response from device configuration");
      reject(new Error("No response"));
    }
    const value = extractValueFromXMLResponse(response, "data");
    const decodedValue = decode(value);
    const parsedValue = parseDeviceConfiguration(decodedValue);
    resolve(parsedValue);
  });
}

export function parseDeviceConfiguration(data) {
  deviceConfiguration = {
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
  return deviceConfiguration;
}

function generateButtonSciXML(data) {
  return `<sci_request version="1.0"><data_service><targets><device id="${device_id}"/></targets><requests><device_request target_name="Button">${data}</device_request></requests></data_service></sci_request>`;
}

//PUMP STATES
export async function updatePumpState(pumpId, state) {
  return new Promise(async (resolve, reject) => {
    const pumpButton = BUTTON_MAP.pumps[pumpId];
    if (!pumpButton) {
      reject(new Error("Invalid pump id"));
    }
    const currentPanelData = await getPanelData();
    if (!currentPanelData) {
      reject(new Error("No panel data"));
    }
    const currentPumpState = currentPanelData.pumpStates[pumpId];
    const stateString = state ? "on" : "off";
    if (state === currentPumpState.state) {
      resolve("Pump already in that state");
    }

    const bodyData = `${pumpButton}:${stateString}`;
    const xmlRequestBody = generateButtonSciXML(bodyData);
    const response = await makeSciRequest(xmlRequestBody);
    resolve(response);
  });
}

//LIGHT STATES
export async function updateLightState(lightId, state) {
  return new Promise(async (resolve, reject) => {
    const lightButton = BUTTON_MAP.lights[lightId];
    if (!lightButton) {
      reject(new Error("Invalid light id"));
    }
    const currentPanelData = await getPanelData();
    if (!currentPanelData) {
      reject(new Error("No panel data"));
    }
    const currentLightState = currentPanelData.lightStates[lightId];
    const stateString = state ? "on" : "off";
    if (state === currentLightState.state) {
      resolve("Light already in that state");
    }

    const bodyData = `${lightButton}:${stateString}`;
    const xmlRequestBody = generateButtonSciXML(bodyData);
    const response = await makeSciRequest(xmlRequestBody);
    resolve(response);
  });
}

//AUX STATES
export async function updateAuxState(auxId, state) {
  return new Promise(async (resolve, reject) => {
    const auxButton = BUTTON_MAP.auxs[auxId];
    if (!auxButton) {
      reject(new Error("Invalid aux id"));
    }
    const currentPanelData = await getPanelData();
    if (!currentPanelData) {
      reject(new Error("No panel data"));
    }
    const currentAuxState = currentPanelData.auxStates[auxId];
    const stateString = state ? "on" : "off";
    if (state === currentAuxState.state) {
      resolve("Aux already in that state");
    }

    const bodyData = `${auxButton}:${stateString}`;
    const xmlRequestBody = generateButtonSciXML(bodyData);
    const response = await makeSciRequest(xmlRequestBody);
    resolve(response);
  });
}

//BLOWER STATES
export async function updateBlowerState(state) {
  return new Promise(async (resolve, reject) => {
    const currentPanelData = await getPanelData();
    if (!currentPanelData) {
      reject(new Error("No panel data"));
    }
    const currentBlowerState = currentPanelData.blowerState;
    const stateString = state ? "on" : "off";
    if (state === currentBlowerState.state) {
      resolve("Blower already in that state");
    }

    const bodyData = `${BUTTON_MAP.blower}:${stateString}`;
    const xmlRequestBody = generateButtonSciXML(bodyData);
    const response = await makeSciRequest(xmlRequestBody);
    resolve(response);
  });
}

//MISTER STATES
export async function updateMisterState(state) {
  return new Promise(async (resolve, reject) => {
    const currentPanelData = await getPanelData();
    if (!currentPanelData) {
      reject(new Error("No panel data"));
    }
    const currentMisterState = currentPanelData.misterState;
    const stateString = state ? "on" : "off";
    if (state === currentMisterState.state) {
      resolve("Mister already in that state");
    }

    const bodyData = `${BUTTON_MAP.mister}:${stateString}`;
    const xmlRequestBody = generateButtonSciXML(bodyData);
    const response = await makeSciRequest(xmlRequestBody);
    resolve(response);
  });
}

//TEMPTEMPERATURE
export async function setTemperature(temperature) {
  return new Promise(async (resolve, reject) => {
    const currentPanelData = await getPanelData();
    if (!currentPanelData) {
      reject(new Error("No panel data"));
    }
    if (temperature === currentPanelData.temperature) {
      resolve("Temperature already set to that value");
    }
    if (currentPanelData.isCelsius) {
      temperature = temperature * 2;
    }

    const xmlRequestBody = `<sci_request version="1.0"><data_service><targets><device id="${device_id}"/></targets><requests><device_request target_name="SetTemp">${temperature}</device_request></requests></data_service></sci_request>`;
    const response = await makeSciRequest(xmlRequestBody);
    resolve(response);
  });
}

export async function setTemperatureRange(rangeHigh) {
  return new Promise(async (resolve, reject) => {
    const currentPanelData = await getPanelData();
    if (!currentPanelData) {
      reject(new Error("No panel data"));
    }
    const currentRange = currentPanelData.range;
    if (rangeHigh === currentRange.state) {
      resolve("Temperature range already set to that value");
    }

    const xmlRequestBody = generateButtonSciXML(BUTTON_MAP.TempRange);
    const response = await makeSciRequest(xmlRequestBody);
    resolve(response);
  });
}

export async function setHeatMode(setToReady) {
  return new Promise(async (resolve, reject) => {
    const currentPanelData = await getPanelData();
    if (!currentPanelData) {
      reject(new Error("No panel data"));
    }
    const currentHeatMode = currentPanelData.heatMode;
    if (
      (setToReady && currentHeatMode === "Ready") ||
      (!setToReady && currentHeatMode === "Rest")
    ) {
      resolve("Heat mode already set to that value");
    }

    const xmlRequestBody = generateButtonSciXML(BUTTON_MAP.HeatMode);
    const response = await makeSciRequest(xmlRequestBody);
    resolve(response);
  });
}

//TIME
export async function setSystemTime(hours, minutes) {
  return new Promise(async (resolve, reject) => {
    const xmlRequestBody = `<sci_request version="1.0"><data_service><targets><device id="${device_id}"/></targets><requests><device_request target_name="SystemTime">${hours}:${minutes}</device_request></requests></data_service></sci_request>`;
    const response = await makeSciRequest(xmlRequestBody);
    resolve(response);
  });
}

export async function setTimeFormat(is24HourTime) {
  return new Promise(async (resolve, reject) => {
    const xmlRequestBody = `<sci_request version="1.0"><data_service><targets><device id="${device_id}"/></targets><requests><device_request target_name="TimeFormat">${
      is24HourTime ? 24 : 12
    }</device_request></requests></data_service></sci_request>`;
    const response = await makeSciRequest(xmlRequestBody);
    resolve(response);
  });
}

//TEMP UNITS
export async function setTempUnits(isCelsius) {
  return new Promise(async (resolve, reject) => {
    const xmlRequestBody = `<sci_request version="1.0"><data_service><targets><device id="${device_id}"/></targets><requests><device_request target_name="TempUnits">${
      isCelsius ? "C" : "F"
    }</device_request></requests></data_service></sci_request>`;
    const response = await makeSciRequest(xmlRequestBody);
    resolve(response);
  });
}

export function farenheitToCelsius(farenheit) {
  // Convert Farenheit to Celsius to nearest 0.5
  return Math.round((farenheit - 32) / 1.8 * 2) / 2;
}