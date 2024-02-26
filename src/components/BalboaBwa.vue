<template>
  <div class="loading" v-if="loading">
    <span class="spinner"></span>
  </div>
  <div v-if="!panelData || !balboaUserData?.token">
    <form class="login-form" @submit.prevent="balboaLogin(auth.username, auth.password)">
      <h1>Balboa BWA</h1>
      <input type="text" v-model="auth.username" placeholder="Username" required autocomplete="balboa-cloud-username"/>
      <input type="password" v-model="auth.password" placeholder="Password" required autocomplete="balboa-cloud-password" />
      <button type="submit">Login</button>
    </form>
  </div>

  <div class="main-container" v-else>
    <div class="top-menu">
      <div>User: {{ balboaUserData?.username }}</div>
      <div><button @click="logout()">LOGOUT</button></div>
    </div>
    <div class="time-modal" system-time-modal hidden>
      <div>
        <button class="time-picker" onclick="this.lastChild.showPicker()">
          Spa time:
          {{ formatTime(`${panelData?.hours}:${panelData?.minutes}`) }}
          <input
            type="time"
            step="900"
            @change="
              (e) => setSystemTime(...Object.values(getHoursMinutes(e.target.value)))
            "
            onfocus="this.showPicker()"
          />
        </button>
      </div>

      <button
        class="sync-button"
        @click="setSystemTime(new Date().getHours(), new Date().getMinutes())"
      >
        Sync time
      </button>
      <div class="time-format">
        Time format:
        <span class="toggle-button">
          <button @click="setTimeFormat(false)" :disabled="!panelData.is24HourTime">
            12
          </button>
          <button @click="setTimeFormat(true)" :disabled="panelData.is24HourTime">
            24
          </button>
        </span>
      </div>
      <button class="close-modal" @click="closeDialog('system-time-modal')">Close</button>
    </div>
    <div class="temperature-object">
      <div
        class="waves"
        :style="
          panelData.heating.state
            ? 'background-color: rgb(220,100,100);'
            : 'background-color: rgb(103,180,250);'
        "
      >
        <div class="container">
          <div class="time">
            <button class="button-icon-only" @click="showDialog('system-time-modal')">
              {{ formatTime(`${panelData?.hours}:${panelData?.minutes}`) }}
              <svg xmlns="http://www.w3.org/2000/svg" width="2rem" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M13 14h-2V8h2v6m2-13H9v2h6V1M5 13a6.995 6.995 0 0 1 13.79-1.66l.6-.6c.32-.32.71-.53 1.11-.64a8.59 8.59 0 0 0-1.47-2.71l1.42-1.42c-.45-.51-.9-.97-1.41-1.41L17.62 6c-1.55-1.26-3.5-2-5.62-2a9 9 0 0 0-9 9c0 4.63 3.5 8.44 8 8.94v-2.02c-3.39-.49-6-3.39-6-6.92m8 6.96V22h2.04l6.13-6.12l-2.04-2.05L13 19.96m9.85-6.49l-1.32-1.32c-.2-.2-.53-.2-.72 0l-.98.98l2.04 2.04l.98-.98c.2-.19.2-.52 0-.72Z"
                />
              </svg>
            </button>
          </div>
          <div class="temperature">
            {{ panelData?.temperature !== 255 ? panelData?.temperature.toFixed(1) : "--" }}°{{
              panelData?.isCelsius ? "C" : "F"
            }}
          </div>
          <div class="target-temperature">
            <span style="font-size: x-small"> Target temperature </span>
            <span>
              {{ panelData.targetTemperature }} °{{
                panelData?.isCelsius ? "C" : "F"
              }}</span
            >
            <input
              type="range"
              :step="panelData.isCelsius ? '0.5' : '1'"
              class="hide-arrows"
              :min="rangeTemps?.min"
              :max="rangeTemps?.max"
              v-model="panelData.targetTemperature"
              @change="(e) => setTemperature(e.target.value)"
              @mousedown="editingValues = true"
              @mouseup="editingValues = false"
              @touchstart.passive="editingValues = true"
              @touchend="editingValues = false"
            />
          </div>
        </div>
      </div>

      <!-- <div class="filter-status badge" v-if="panelData.filterMode.status !== 'Off'">
        <button class="" :title="panelData?.filterMode.status">
          {{ panelData?.filterMode.status }}
        </button>
      </div> -->

      <div class="temp-scale badge">
        <button
          @click="setTempUnits(!panelData.isCelsius)"
          class=""
          title="Temperature scale"
        >
          °{{ panelData?.isCelsius ? "C" : "F" }}
          <!-- °C/°F -->
        </button>
      </div>
      <div class="temp-range badge">
        <button
          class=""
          @click="setTemperatureRange(!panelData?.range.state)"
          :title="panelData.range.status"
        >
          <svg
            v-if="panelData.range.state"
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            width="1.5rem"
            viewBox="0 0 32 32"
            version="1.1"
          >
            <path
              d="M12.75 6.008c0-6.246-9.5-6.246-9.5 0v13.238c-1.235 1.224-2 2.921-2 4.796 0 3.728 3.022 6.75 6.75 6.75s6.75-3.022 6.75-6.75c0-1.875-0.765-3.572-2-4.796l-0.001-0zM8 29.25c-2.9-0-5.25-2.351-5.25-5.251 0-1.553 0.674-2.948 1.745-3.909l0.005-0.004 0.006-0.012c0.13-0.122 0.215-0.29 0.231-0.477l0-0.003c0.001-0.014 0.007-0.024 0.008-0.038l0.006-0.029v-13.52c-0.003-0.053-0.005-0.115-0.005-0.178 0-1.704 1.381-3.085 3.085-3.085 0.060 0 0.12 0.002 0.179 0.005l-0.008-0c0.051-0.003 0.111-0.005 0.17-0.005 1.704 0 3.085 1.381 3.085 3.085 0 0.063-0.002 0.125-0.006 0.186l0-0.008v13.52l0.006 0.029c0 0.014 0.006 0.024 0.008 0.038 0.016 0.19 0.101 0.358 0.23 0.479l0 0 0.006 0.012c1.076 0.966 1.75 2.361 1.75 3.913 0 2.9-2.35 5.25-5.25 5.251h-0zM8.75 21.367v-15.367c0-0.414-0.336-0.75-0.75-0.75s-0.75 0.336-0.75 0.75v0 15.367c-1.164 0.338-2 1.394-2 2.646 0 1.519 1.231 2.75 2.75 2.75s2.75-1.231 2.75-2.75c0-1.252-0.836-2.308-1.981-2.641l-0.019-0.005zM30.531 9.47l-6-6c-0.025-0.025-0.064-0.017-0.092-0.038-0.052-0.041-0.089-0.099-0.152-0.125-0.050-0.013-0.108-0.020-0.168-0.020-0.010 0-0.020 0-0.030 0.001l0.001-0c-0.041-0.009-0.088-0.014-0.136-0.014-0.004 0-0.008 0-0.012 0h0.001c-0.184 0.006-0.351 0.079-0.475 0.197l0-0-5.999 6c-0.135 0.136-0.218 0.322-0.218 0.528 0 0.414 0.336 0.75 0.75 0.75 0.206 0 0.393-0.083 0.529-0.218l4.719-4.72v22.189c0 0.414 0.336 0.75 0.75 0.75s0.75-0.336 0.75-0.75v0-22.188l4.719 4.719c0.136 0.135 0.323 0.218 0.529 0.218 0.415 0 0.751-0.336 0.751-0.751 0-0.206-0.083-0.393-0.218-0.528l0 0z"
            />
          </svg>
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            width="1.5rem"
            viewBox="0 0 32 32"
            version="1.1"
          >
            <path
              d="M12.75 6.008c0-6.246-9.5-6.246-9.5 0v13.238c-1.235 1.224-2 2.921-2 4.796 0 3.728 3.022 6.75 6.75 6.75s6.75-3.022 6.75-6.75c0-1.875-0.765-3.572-2-4.796l-0.001-0zM8 29.25c-2.9-0-5.25-2.351-5.25-5.251 0-1.553 0.674-2.948 1.745-3.909l0.005-0.004 0.006-0.012c0.13-0.122 0.215-0.29 0.231-0.477l0-0.003c0.001-0.014 0.007-0.024 0.008-0.038l0.006-0.029v-13.52c-0.003-0.053-0.005-0.115-0.005-0.178 0-1.704 1.381-3.085 3.085-3.085 0.060 0 0.12 0.002 0.179 0.005l-0.008-0c0.051-0.003 0.111-0.005 0.17-0.005 1.704 0 3.085 1.381 3.085 3.085 0 0.063-0.002 0.125-0.006 0.186l0-0.008v13.52l0.006 0.029c0 0.014 0.006 0.024 0.008 0.038 0.016 0.19 0.101 0.358 0.23 0.479l0 0 0.006 0.012c1.076 0.966 1.75 2.361 1.75 3.913 0 2.9-2.35 5.25-5.25 5.251h-0zM8.75 21.367v-1.367c0-0.414-0.336-0.75-0.75-0.75s-0.75 0.336-0.75 0.75v0 1.367c-1.164 0.338-2 1.394-2 2.646 0 1.519 1.231 2.75 2.75 2.75s2.75-1.231 2.75-2.75c0-1.252-0.836-2.308-1.981-2.641l-0.019-0.005zM30.531 21.469c-0.136-0.136-0.324-0.22-0.531-0.22s-0.395 0.084-0.531 0.22v0l-4.719 4.719v-22.188c0-0.414-0.336-0.75-0.75-0.75s-0.75 0.336-0.75 0.75v0 22.189l-4.719-4.721c-0.136-0.136-0.324-0.22-0.531-0.22-0.415 0-0.751 0.336-0.751 0.751 0 0.207 0.084 0.395 0.22 0.531v0l5.999 6c0.136 0.135 0.324 0.219 0.531 0.219h0c0.104-0.001 0.202-0.021 0.292-0.059l-0.005 0.002c0.062-0.026 0.098-0.083 0.149-0.123 0.029-0.021 0.069-0.013 0.095-0.039l6-6c0.135-0.136 0.218-0.324 0.218-0.531s-0.083-0.395-0.218-0.531l0 0z"
            />
          </svg>
        </button>
      </div>
      <div class="heat-mode badge">
        <button
          @click="setHeatMode(!panelData.heatMode.toLowerCase().includes('ready'))"
          :title="panelData?.heatMode"
        >
          {{ panelData?.heatMode }}
        </button>
      </div>
      <div
        class="heating badge"
        v-if="panelData.heating.state"
        :title="panelData?.heating.state ? panelData?.heating.status : ''"
      >
        <Fire />
      </div>
    </div>

    <div class="controlers">
      <button
        class="device-button"
        :class="{ active: panelData?.circPump.state }"
        @click=""
        v-if="panelData?.circPump.present"
      >
        Circ pump
      </button>
      <button
        class="device-button"
        :class="{ active: panelData?.blowerState.state }"
        @click="updateBlowerState(!panelData?.blowerState.state)"
        v-if="myBlower.present"
      >
        Blower
      </button>

      <button
        class="device-button"
        :class="{ active: aux.state }"
        @click="updateAuxState(aux.id, !aux.state)"
        v-for="aux in myAuxs"
      >
        Aux{{ aux.id }}
      </button>

      <button
        class="device-button"
        :class="{ active: pump.state }"
        @click="updatePumpState(pump.id, !pump.state)"
        v-for="pump in myPumps"
      >
        Pump{{ pump.id }}
      </button>

      <button
        class="device-button"
        :class="{ active: light.state }"
        @click="updateLightState(light.id, !light.state)"
        v-for="light in myLights"
      >
        Light{{ light.id }}
      </button>
    </div>

    <div class="filter-cycles">
      <div class="filter-cycle" v-for="filter in filterCycles">
        <button
          class="filter-active-button"
          :class="{
            'filter-active': filter.active,
            'filter-running': panelData?.filterMode.state[filter.id],
          }"
          @click="
            filter.active = !filter.active;
            updateFilterCycles();
          "
          :disabled="!filter.switchable"
        >
          Filter{{ filter.id }}
          <span v-if="panelData?.filterMode.state[filter.id]">(running)</span>
        </button>
        <div class="filter-cycle-timeblock">
          <span>Start:</span>
          <button class="time-picker" onclick="this.lastChild.showPicker()">
            {{ formatTime(filter.startTime) }}
            <input
              type="time"
              step="900"
              v-model="filter.startTime"
              @change="
                updateFilterTimes(filter);
                updateFilterCycles();
              "
              onfocus="this.showPicker()"
            />
          </button>
        </div>

        <div class="filter-cycle-timeblock">
          <span>End:</span>
          <button class="time-picker" onclick="this.lastChild.showPicker()">
            {{ formatTime(filter.endTime) }}
            <input
              type="time"
              step="900"
              v-model="filter.endTime"
              @change="
                updateFilterTimes(filter);
                updateFilterCycles();
              "
              onfocus="this.showPicker()"
            />
          </button>
        </div>
      </div>
    </div>

    <div class="footer">
      Model: {{ systemInformation?.modelName }} | SW:
      {{ systemInformation?.softwareId }} | Sync:
      {{ new Date(lastSync).toLocaleString("sk") }}
      <div>Created by <a href="mailto:jozefnad@gmail.com">Jozef Naď</a></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onBeforeMount, watch } from "vue";
import * as balboa from "../assets/balboa.js";

import Fire from "./Fire.vue";

const timeouts = {};

const loading = ref(true);

const auth = ref({ username: "", password: "" });

const lastSync = ref(null);
const editingValues = ref(false);

const balboaUserData = ref(null);
const setupParameters = ref(null);
const systemInformation = ref(null);
const panelData = ref(null);
const filterCycles = ref(null);

onBeforeMount(() => {
  (async () => {
    const storedBalboaSession = getBalboaSession();

    console.log("storedBalboaSession", storedBalboaSession);
    if (storedBalboaSession?.token && storedBalboaSession?.device.device_id) {
      balboa.updateUserData(storedBalboaSession);
      balboaUserData.value = storedBalboaSession;
    } else {
      console.log("no stored session");
      loading.value = false;
    }
    watch(
      balboa.balboaToken,
      (token) => {
        if (token) {
          return getBalboaData();
        }
        logout();
      },
      { immediate: true }
    );
  })();
});
// Event listener for visibility change
document.addEventListener("visibilitychange", function () {
  if (document.hidden) {
    console.log("hidden");
    for (const key in timeouts) {
      clearTimeout(timeouts[key]);
    }
  } else {
    console.log("visible");
    if (balboa.balboaToken) {
      return getBalboaData();
    }
    logout();
  }
});

const myPumps = computed(() => {
  const pumps = panelData.value?.pumpStates || {};
  return Object.values(pumps).filter((pump) => pump.present);
});

const myLights = computed(() => {
  const lights = panelData.value?.lightStates || {};
  return Object.values(lights).filter((light) => light.present);
});

const myBlower = computed(() => {
  return panelData.value?.blowerState.present ? panelData.value?.blowerState : [];
});

const myAuxs = computed(() => {
  const auxs = panelData.value?.auxStates || {};
  return Object.values(auxs).filter((aux) => aux.present);
});

const rangeTemps = computed(() => {
  if (!panelData.value || !setupParameters.value) return { min: 0, max: 0 };
  const { min, max } = panelData.value?.range.state
    ? setupParameters.value?.highRange
    : setupParameters.value?.lowRange;
  return panelData.value?.isCelsius
    ? {
        min: balboa.farenheitToCelsius(min),
        max: balboa.farenheitToCelsius(max),
      }
    : { min, max };
});

function getBalboaSession() {
  try {
    return JSON.parse(localStorage.getItem("balboaSession"));
  } catch (error) {
    console.error("Error parsing balboaSession from localStorage:", error);
    return {}; // or some default value
  }
}

// This function is used to get the Balboa data.
async function getBalboaData() {
  loading.value = true;
  await Promise.all([
    getPanelData(),
    getFilterCycles(),
    getSetupParameters(),
    getSystemInformation(),
  ]);
  loading.value = false;
}

// This function is used to login to Balboa.
async function balboaLogin(username, password) {
  try {
    loading.value = true;
    const response = await balboa.login(username, password);
    console.log(response);
    localStorage.setItem("balboaSession", JSON.stringify(response));
    balboaUserData.value = response;
    loading.value = false;
  } catch (error) {
    console.error("Error logging in:", error);
    loading.value = false;
    throw error;
  }
}

// This function is used to logout from Balboa.
async function logout() {
  console.log("logging out");
  //clear all timeouts
  for (const key in timeouts) {
    clearTimeout(timeouts[key]);
  }
  localStorage.removeItem("balboaSession");
  balboaUserData.value = null;
}

// This function is used to get the panel data.
async function getPanelData() {
  try {
    clearTimeout(timeouts.getPanelData);
    const response = await balboa.getPanelData();
    if (!editingValues.value) {
      panelData.value = response;
      lastSync.value = new Date();
    }
    timeouts.getPanelData = setTimeout(getPanelData, 1000);
  } catch (error) {
    console.error("Error getting panel data:", error);
    if (!balboa.balboaToken.value) {
      return logout();
    }
    timeouts.getPanelData = setTimeout(getPanelData, 1000);
  }
}

// This function is used to get the filter cycles.
async function getFilterCycles() {
  try {
    const response = await balboa.getFilterCycles();
    console.log(response);
    let updatedResponse = {};
    for (const key in response) {
      let filter = { ...response[key] };
      filter.startTime = getFilterStartTime(filter.startHours, filter.startMinutes);
      filter.endTime = getFilterEndTime(
        filter.startHours,
        filter.startMinutes,
        filter.durationHours,
        filter.durationMinutes
      );
      updatedResponse[key] = filter;
    }
    filterCycles.value = updatedResponse;
  } catch (error) {
    console.error("Error getting filter cycles:", error);
  }
}

// This function is used to get the setup parameters.
async function getSetupParameters() {
  try {
    const response = await balboa.getSetupParameters();
    console.log(response);
    setupParameters.value = response;
  } catch (error) {
    console.error("Error getting setup parameters:", error);
  }
}

// This function is used to get the system information.
async function getSystemInformation() {
  try {
    const response = await balboa.getSystemInformation();
    console.log(response);
    systemInformation.value = response;
  } catch (error) {
    console.error("Error getting system information:", error);
  }
}

// This function is used to set the system time.
async function setSystemTime(hours, minutes) {
  try {
    loading.value = true;
    const response = await balboa.setSystemTime(hours, minutes);
    console.log(response);
    await getPanelData();
    closeDialog("system-time-modal");
    loading.value = false;
  } catch (error) {
    console.error("Error setting system time:", error);
    await getPanelData();
    loading.value = false;
  }
}

async function setTimeFormat(is24HourTime) {
  try {
    loading.value = true;
    clearTimeout(timeouts.getPanelData);
    const response = await balboa.setTimeFormat(is24HourTime);
    console.log(response);
    await getPanelData();
    closeDialog("system-time-modal");
    loading.value = false;
  } catch (error) {
    console.error("Error setting time format:", error);
    await getPanelData();
    loading.value = false;
  }
}

// This function is used to set the heat mode.
async function setHeatMode(state) {
  try {
    loading.value = true;
    clearTimeout(timeouts.getPanelData);
    const response = await balboa.setHeatMode(state);
    console.log(response);
    await getPanelData();
    loading.value = false;
  } catch (error) {
    console.error("Error setting heat mode:", error);
    await getPanelData();
    loading.value = false;
  }
}

// This function is used to set the temperature.
async function setTemperature(temperature) {
  try {
    loading.value = true;
    clearTimeout(timeouts.getPanelData);
    const response = await balboa.setTemperature(temperature);
    console.log(response);
    await getPanelData();
    loading.value = false;
  } catch (error) {
    console.error("Error setting temperature:", error);
    await getPanelData();
    loading.value = false;
  }
}

async function setTemperatureRange(state) {
  try {
    loading.value = true;
    clearTimeout(timeouts.getPanelData);
    const response = await balboa.setTemperatureRange(state);
    console.log(response);
    await getPanelData();
    loading.value = false;
  } catch (error) {
    console.error("Error setting temperature range:", error);
    await getPanelData();
    loading.value = false;
  }
}

async function setTempUnits(state) {
  try {
    loading.value = true;
    clearTimeout(timeouts.getPanelData);
    const response = await balboa.setTempUnits(state);
    console.log(response);
    await getPanelData();
    loading.value = false;
  } catch (error) {
    console.error("Error setting temperature units:", error);
    await getPanelData();
    loading.value = false;
  }
}

// This function is used to update the blower state.
async function updateBlowerState(state) {
  try {
    loading.value = true;
    clearTimeout(timeouts.getPanelData);
    const response = await balboa.updateBlowerState(state);
    await getPanelData();
    loading.value = false;
  } catch (error) {
    console.error("Error updating blower state:", error);
    await getPanelData();
    loading.value = false;
  }
}

// This function is used to update the auxiliary state.
async function updateAuxState(id, state) {
  try {
    loading.value = true;
    clearTimeout(timeouts.getPanelData);
    const response = await balboa.updateAuxState(id, state);
    await getPanelData();
    loading.value = false;
  } catch (error) {
    console.error("Error updating auxiliary state:", error);
    await getPanelData();
    loading.value = false;
  }
}

// This function is used to update the pump state.
async function updatePumpState(id, state) {
  try {
    loading.value = true;
    clearTimeout(timeouts.getPanelData);
    const response = await balboa.updatePumpState(id, state);
    await getPanelData();
    loading.value = false;
  } catch (error) {
    console.error("Error updating pump state:", error);
    await getPanelData();
    loading.value = false;
  }
}

// This function is used to update the light state.
async function updateLightState(id, state) {
  try {
    loading.value = true;
    clearTimeout(timeouts.getPanelData);
    const response = await balboa.updateLightState(id, state);
    await getPanelData();
    loading.value = false;
  } catch (error) {
    console.error("Error updating light state:", error);
    await getPanelData();
    loading.value = false;
  }
}

// This function is used to update the filter cycles.
async function updateFilterCycles() {
  try {
    loading.value = true;
    const filterCyclesArray = balboa.generateFilterCyclesArray(filterCycles.value);
    const response = await balboa.setFilterCycles(filterCyclesArray);
    await getFilterCycles();
    loading.value = false;
  } catch (error) {
    console.error("Error updating filter cycles:", error);
    await getFilterCycles();
    loading.value = false;
  }
}

// This function is used to format the time.
function formatTime(time) {
  const hours = parseInt(time.split(":")[0]);
  const minutes = parseInt(time.split(":")[1]);
  return new Date(new Date().setHours(hours, minutes, 0, 0)).toLocaleTimeString(
    panelData.value?.is24HourTime ? "sk" : "en",
    { hour: "numeric", minute: "numeric" }
  );
}

function getHoursMinutes(time) {
  const hours = parseInt(time.split(":")[0]);
  const minutes = parseInt(time.split(":")[1]);
  return { hours, minutes };
}

function getFilterStartTime(startHours, startMinutes) {
  const hours = startHours.toString().padStart(2, "0");
  const minutes = startMinutes.toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

// This function is used to get the filter end time.
function getFilterEndTime(startHours, startMinutes, durationHours, durationMinutes) {
  const start = new Date(new Date().setHours(startHours, startMinutes, 0, 0));
  const end = new Date(
    start.getTime() + durationHours * 60 * 60 * 1000 + durationMinutes * 60 * 1000
  );
  return `${end
    .getHours()
    .toString()
    .padStart(2, "0")}:${end.getMinutes().toString().padStart(2, "0")}`;
}

function updateFilterTimes(filter) {
  if (filter.startTime === filter.endTime) {
    // If start time and end time are same, set duration for 24 hours and 0 minutes
    filter.durationHours = 24;
    filter.durationMinutes = 0;
  } else {
    filter.startHours = parseInt(filter.startTime.split(":")[0]);
    filter.startMinutes = parseInt(filter.startTime.split(":")[1]);
    let endHours = parseInt(filter.endTime.split(":")[0]);
    let endMinutes = parseInt(filter.endTime.split(":")[1]);

    if (
      endHours < filter.startHours ||
      (endHours === filter.startHours && endMinutes < filter.startMinutes)
    ) {
      // If the end time is earlier than the start time, it means the end time is on the next day.
      endHours += 24;
    }

    filter.durationHours = endHours - filter.startHours;
    filter.durationMinutes = endMinutes - filter.startMinutes;

    if (filter.durationMinutes < 0) {
      // If the end minutes are less than the start minutes, borrow 1 hour.
      filter.durationMinutes += 60;
      filter.durationHours--;
    }
  }
}

function showDialog(id) {
  const dialog = document.querySelector(`[${id}]`);
  dialog.hidden = false;
}
function closeDialog(id) {
  const dialog = document.querySelector(`[${id}]`);
  dialog.hidden = true;
}
</script>

<style lang="scss" scoped>
* {
  user-select: none;
  box-sizing: border-box;
  -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
  -webkit-tap-highlight-color: transparent;
}

.loading {
  position: fixed;
  /* Changed from absolute to fixed */
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  width: 100%;
  z-index: 1000;
  top: 0;
  /* Added to cover the whole screen */
  left: 0;
  /* Added to cover the whole screen */
  background-color: rgba(0, 0, 0, 0.5);
  /* Added to create a semi-transparent overlay */
}

.spinner {
  border: 5px solid #f3f3f3;
  border-top: 5px solid #3498db;
  border-radius: 50%;
  width: 5rem;
  height: 5rem;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

button {
  cursor: pointer;
}

button:active {
  transform: scale(0.95);
}

.login-form {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;

  input {
    margin-bottom: 1rem;
    border: 1px solid #ccc;
    padding: 0.5rem;
    border-radius: 0.5rem;
  }

  button {
    padding: 0.5rem;
    border-radius: 0.5rem;
    background: #40b1bf;
    border: none;
    color: white;
    font-size: 1.2rem;
  }
}

.top-menu {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 0.5rem;
  margin-bottom: 0.5rem;
  // background-color: #f0f0f0;
  border-bottom: 1px solid #ccc;

  button {
    background-color: #d64d4d;
    color: white;
    border: none;
    padding: 0.5rem;
    border-radius: 0.5rem;
  }
}

.footer {
  // position: absolute;
  // bottom: 0;
  // align-self: flex-end;
  width: 100%;
  text-align: center;
  padding: 0.5rem;
  background-color: #ffffff;
  border-top: 1px solid #ccc;
  font-size: x-small;
}

.main-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  height: 100vh;
}

.main-container.loading {
  pointer-events: none;
}

.button {
  background-color: rgb(79, 129, 129);
  border-radius: 0.5rem;
  padding: 0.5rem;
  color: white;
  border: none;
  cursor: pointer;
}

.temperature-object {
  position: relative;
  z-index: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 90%;
  max-width: 30rem;
  aspect-ratio: 1/1;
}

.waves {
  overflow: hidden;
  z-index: -1;
  position: relative;
  width: 100%;
  aspect-ratio: 1/1;
  border-radius: 50%;
  border: 2px solid #cccccc;

  &:before,
  &:after {
    content: "";
    position: absolute;
    z-index: -1;
    left: 50%;
    min-width: 150%;
    min-height: 150%;
    background: radial-gradient(rgb(255 255 255), #ffffffcc);
    animation-name: rotate;
    animation-iteration-count: infinite;
    animation-timing-function: linear;
  }

  &:before {
    bottom: 35%;
    border-radius: 45%;
    animation-duration: 10s;
  }

  &:after {
    bottom: 30%;
    opacity: 0.5;
    border-radius: 47%;
    animation-duration: 10s;
  }
}

@keyframes rotate {
  0% {
    transform: translate(-50%, 0) rotateZ(0deg);
  }

  50% {
    transform: translate(-50%, -5%) rotateZ(180deg);
  }

  100% {
    transform: translate(-50%, 0%) rotateZ(360deg);
  }
}

.container {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
}

.time {
  flex-grow: 1;
  display: flex;
  justify-content: center;
  align-items: center;

  button {
    display: flex;
    font-size: 2rem;
    margin-left: 0.1rem;
    background-color: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
    height: 1.3rem;
  }
}

.time-modal {
  position: absolute;
  //middle of website
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  background-color: #fff;
  padding: 1rem;
  text-align: center;
  border: 2px solid #ccc;
  border-radius: 1rem;
  height: fit-content;

  button {
    margin: 0.5rem;
    padding: 0.5rem;
    border: none;
    border-radius: 0.5rem;
  }

  .time-picker {
    border: 1px solid #ccc;
    font-size: 1rem;
    font-weight: bold;
  }

  .sync-button {
    background-color: #40b1bf;
    color: white;
  }

  .close-modal {
    margin-top: 2rem;
    background-color: #d64d4d;
    color: white;
    font-size: 1rem;
  }
}

.toggle-button {
  display: inline-block;

  button {
    margin: 0;
    border-radius: 0;
    background-color: #ccc;
    opacity: 0.8;
    width: 3rem;
  }

  button:disabled {
    opacity: 1;
    pointer-events: none;
    background-color: #40b1bf;
    color: white;
  }

  //first-child
  :first-child {
    border-top-left-radius: 0.5rem;
    border-bottom-left-radius: 0.5rem;
  }

  :last-child {
    border-top-right-radius: 0.5rem;
    border-bottom-right-radius: 0.5rem;
  }
}

.temperature {
  font-size: 5rem;
  font-weight: bold;
  flex-grow: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.target-temperature {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  font-size: 1.5rem;
}

.target-temperature input[type="number"] {
  width: 2rem;
  font-size: 1.5rem;
  background-color: transparent;
  border: none;
}

.heating {
  position: absolute;
  bottom: 0;
  right: 0;
}

.temperature-object > .badge {
  width: 20%;
}

.temperature-object > .badge > button {
  width: 100%;
  aspect-ratio: 1/1;
  background-color: #fff;
  border: #cccccc 2px solid;
  border-radius: 50%;
  // padding: .5rem;
  font-weight: bold;
  cursor: pointer;
}

.filter-status {
  position: absolute;
  left: -10%;
  transform: translateY(-50%, -50%);
}

.temp-scale {
  position: absolute;
  bottom: 0;
  left: 0;

  button {
    font-size: 1.5rem;
  }
}

.temp-range {
  position: absolute;
  top: 0;
  left: 0;

  // button {}
}

.heat-mode {
  position: absolute;
  top: 0;
  right: 0;

  // button {}
}

.controlers {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  margin: 0.5rem 0;
  flex: 1;
  overflow: auto;
}

.device-button {
  margin: 0.2rem;
  height: 5rem;
  width: 5rem;
  cursor: pointer;
  font-size: 1rem;
  font-weight: bold;
  background: #ffffff;
  // background: radial-gradient(rgb(255, 255, 255), rgb(218, 95, 97));
  border-radius: 50%;
  opacity: 0.5;
  border: 0.5rem solid rgba(218, 95, 97, 0.534);
}

.filter-cycles {
  width: 100%;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  margin: 0.5rem;
  // border: 1px solid #ccc;
  // border-radius: .5rem;

  .filter-cycle {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 0.5rem;

    * {
      font-size: 1rem;
    }
  }

  .filter-active-button {
    width: 100%;
    padding: 0.5rem;
    font-weight: bold;
    color: #000000;
    background-color: #ffffff;
    opacity: 0.6;
    border: 0.2rem solid;
    border-color: rgb(245 211 213);
    border-radius: 0.5rem;
    cursor: pointer;
  }

  .filter-active-button.filter-active {
    opacity: 1;
    border-color: #40b1bf;
  }

  .filter-active-button.filter-running {
    animation: colorChange 3s infinite;
  }

  @keyframes colorChange {
    0% {
      background-color: #40b1bf;
    }

    50% {
      background-color: #ffffff;
    }

    100% {
      background-color: #40b1bf;
    }
  }

  .filter-cycle-timeblock {
    width: 100%;
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;

    span {
      flex: 1;
      font-size: 1rem;
      text-align: center;
    }

    button {
      flex: 1;
    }
  }

  div {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
  }
}

.time-picker {
  border: 1px solid #ccc;
  border-radius: 0.5rem;
  padding: 0.3rem 0.5rem;
  background-color: #fff;

  input[type="time"] {
    width: 0;
    height: 0;
    opacity: 0;
    position: absolute;
    // z-index: -1;
  }
}

.device-button.active {
  opacity: 1;
  border: 0.5rem solid #40b1bf;
  background-color: #40b1bf20;
}

.hide-arrows::-webkit-inner-spin-button,
.hide-arrows::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.hide-arrows {
  -moz-appearance: textfield;
  appearance: textfield;
}
</style>
