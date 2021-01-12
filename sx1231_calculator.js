/**
 * sx1231_calculator.js - SX1231 settings calculator
 *
 * Copyright (c) 2019 David Imhoff <dimhoff.devel <at> gmail.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
"use strict";

/**
 * TODO:
 *  - Low Battery detection settings (0x0C)
 *  - Listen mode (0x0D-0x0F)
 *  - Timeouts (0x2A-0x2B)
 *  - PIIBW (0x5F)
 */

const formElements = document.getElementById("frmSettings");

const AES_BLOCK_SIZE = 16;

const MOD_FSK = 0;
const MOD_OOK = 1;

const MODE_PCKT = 0;
const MODE_CONT = 1;

const FMT_FIXED_LEN = 0;
const FMT_VAR_LEN = 1;
const FMT_UNLIMITED_LEN = 2;

const ENC_NONE = 0;
const ENC_MANCHESTER = 1;
const ENC_WHITENING = 2;

const ADDR_FILT_NONE = 0;
const ADDR_FILT_NODE = 1;
const ADDR_FILT_NODE_BCAST = 2;

// Power-On-Reset register values
const POR_REGS = {
  0x00: 0x00,
  0x01: 0x04,
  0x02: 0x00,
  0x03: 0x1A,
  0x04: 0x0B,
  0x05: 0x00,
  0x06: 0x52,
  0x07: 0xE4,
  0x08: 0xC0,
  0x09: 0x00,
  0x0A: 0x41,
  0x0B: 0x00,
  0x0C: 0x02,
  0x0D: 0x92,
  0x0E: 0xF5,
  0x0F: 0x20,
  0x10: 0x23,
  0x11: 0x9F,
  0x12: 0x09,
  0x13: 0x1A,
  0x14: 0x40,
  0x15: 0xB0,
  0x16: 0x7B,
  0x17: 0x9B,
  0x18: 0x08,
  0x19: 0x86,
  0x1A: 0x8A,
  0x1B: 0x40,
  0x1C: 0x80,
  0x1D: 0x06,
  0x1E: 0x10,
  0x1F: 0x00,
  0x20: 0x00,
  0x21: 0x00,
  0x22: 0x00,
  0x23: 0x02,
  0x24: 0xFF,
  0x25: 0x00,
  0x26: 0x05,
  0x27: 0x80,
  0x28: 0x00,
  0x29: 0xFF,
  0x2A: 0x00,
  0x2B: 0x00,
  0x2C: 0x00,
  0x2D: 0x03,
  0x2E: 0x98,
  0x2F: 0x00,
  0x30: 0x00,
  0x31: 0x00,
  0x32: 0x00,
  0x33: 0x00,
  0x34: 0x00,
  0x35: 0x00,
  0x36: 0x00,
  0x37: 0x10,
  0x38: 0x40,
  0x39: 0x00,
  0x3A: 0x00,
  0x3B: 0x00,
  0x3C: 0x0F,
  0x3D: 0x02,
  0x3E: 0x00,
  0x3F: 0x00,
  0x40: 0x00,
  0x41: 0x00,
  0x42: 0x00,
  0x43: 0x00,
  0x44: 0x00,
  0x45: 0x00,
  0x46: 0x00,
  0x47: 0x00,
  0x48: 0x00,
  0x49: 0x00,
  0x4A: 0x00,
  0x4B: 0x00,
  0x4C: 0x00,
  0x4D: 0x00,
  0x4E: 0x01,
  0x4F: 0x00,
  0x58: 0x1B,
  0x59: 0x09,
  0x5F: 0x08,
  0x6F: 0x00,
  0x71: 0x00
};

function bToHexStr(val) {
  if (val < 0x10) return "0" + Number(val).toString(16);
  return Number(val).toString(16);
}

function showByClassName(className) {
  for (const el of document.getElementsByClassName(className)) {
    el.classList.remove('hidden');
  }
}

function hideByClassName(className) {
  for (const el of document.getElementsByClassName(className)) {
    el.classList.add('hidden');
  }
}

function formUpdateDisabledByVisibility(form) {
  // TODO: probably better to use fieldsets for this...
  for (const el of form) {
    if (el.offsetParent === null) {
      el.disabled = true;
    } else {
      el.disabled = false;
    }
  }
}

function formEnableAll(form) {
  for (const el of form) {
    el.disabled = false;
  }
}

function toggleModulationSettings() {
  const isFSK = (formElements['modulation'].value == MOD_FSK);

  if (isFSK) {
    showByClassName("FSKOnly");
    hideByClassName("OOKOnly");
  } else {
    showByClassName("OOKOnly");
    hideByClassName("FSKOnly");
  }
}

function updateModulationShapingOptions() {
  const el = formElements['modulation_shaping'];

  const modulation = formElements['modulation'].value;
  let optionTexts = null;
  if (modulation == MOD_FSK) {
    optionTexts = [
      "Gaussian filter, BT = 1.0",
      "Gaussian filter, BT = 0.5",
      "Gaussian filter, BT = 0.3",
    ];
  } else {
    optionTexts = [
        "Filtering with f_cutoff = BR",
        "Filtering with f_cutoff = 2*BR"
    ];
  }

  const oldValue = el.value;
  el.options.length = 0;

  // Option - None
  let optionNone = document.createElement("OPTION");

  optionNone.value = 0;
  optionNone.text = "No Shaping";

  el.appendChild(optionNone);

  // Generate select items
  for (let i = 0; i < optionTexts.length; i++) {
    let newOption = document.createElement("OPTION");

    newOption.value = i + 1;
    newOption.text = optionTexts[i];

    el.appendChild(newOption);
  }

  // Set Value
  if (oldValue) {
    el.value = oldValue;
  } else {
    el.value = "0"; // default value
  }
  el.checkValidity();
}

function toggleOcpSettings() {
  const el = document.getElementById("settingsTXOCP");

  const ocp_on = formElements['ocp_on'].checked;
  if (ocp_on === true) {
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

function toggleLowBetaSettings() {
  const el = document.getElementById("settingsLowBeta");

  const value = parseInt(formElements['modulation_index'].value);

  if (value < 2) {
    el.style.display = null;
  } else {
    el.style.display = "none";
  }
}

function toggleAfcLowBetaSettings() {
  const el = document.getElementById("settingsAfcLowBeta");

  const value = formElements['afc_low_beta_on'].checked;
  if (value === true) {
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

function toggleOokThresholdSettings() {
  const peakSettingsEl = document.getElementById("settingsOokPeakThreshold");
  const avgSettingsEl = document.getElementById("settingsOokAverageThreshold");
  const fixedSettingsEl = document.getElementById("settingsOokFixedThreshold");

  const value = parseInt(formElements['ook_thresh_type'].value);
  switch (value) {
    case 0:
      fixedSettingsEl.style.display = null;
      peakSettingsEl.style.display = "none";
      avgSettingsEl.style.display = "none";
      break;
    case 1:
      fixedSettingsEl.style.display = "none";
      peakSettingsEl.style.display = null;
      avgSettingsEl.style.display = "none";
      break;
    case 2:
      fixedSettingsEl.style.display = "none";
      peakSettingsEl.style.display = "none";
      avgSettingsEl.style.display = null;
      break;
    default:
      fixedSettingsEl.style.display = "none";
      peakSettingsEl.style.display = "none";
      avgSettingsEl.style.display = "none";
      break;
  }
}

function updateFStep() {
  const el = formElements['fstep'];
  const fxo = parseFloat(formElements['fxo'].value) * 1e6;

  el.value = fxo / Math.pow(2, 19);
  el.dispatchEvent(new Event('change'));
}

function updateModulationIndex() {
  const freqDev = parseFloat(formElements['fdev'].value) * 1000;
  const bitRate = parseFloat(formElements['bit_rate'].value);
  const elemModIndex = formElements["modulation_index"];

  // TODO: this doesn't account of FSTEP
  const newValue = 2 * freqDev / bitRate;

  elemModIndex.value = newValue;
  elemModIndex.dispatchEvent(new Event('change'));

  // Check constraints
  if (newValue < 0.5 || newValue > 10) {
    elemModIndex.setCustomValidity("beta should be >= 0.5 and <= 10");
  } else {
    elemModIndex.setCustomValidity("");
  }
}

function updatePaPowerMax() {
  const el = formElements['pa_power'];
  const txPin = parseInt(formElements['tx_pin_select'].value);

  if (txPin) {
    el.max = 17;
  } else {
    el.max = 13;
  }

  el.value = el.value; // Force validition even if value == default
  el.checkValidity();
}

function updateRxBwOptions() {
  const el = formElements['rx_bw'];
  const afcEl = formElements['afc_bw'];

  const fxo = parseFloat(formElements['fxo'].value) * 1e6;

  const calcRxBw = (fxo, rxBwMant, rxBwExp) => {
    // for modulation OOK add 1 to rxBwExp 
    return fxo / (rxBwMant * Math.pow(2, (rxBwExp + 2)));
  };

  const oldValue = el.value;
  const oldAfcValue = el.value;

  // Generate select items
  el.options.length = 0;
  afcEl.options.length = 0;
  for (let rxBwExp = 8; rxBwExp >= 0; rxBwExp--) {
    for (const rxBwMant of [ 24, 20, 16 ]) {
      let newOption = document.createElement("OPTION");
      newOption.value = rxBwMant + ";" + rxBwExp;
      newOption.text = Math.round(calcRxBw(fxo, rxBwMant, rxBwExp )) / 1000;

      el.appendChild(newOption);
      afcEl.appendChild(newOption.cloneNode(true));
    }
  }

  if (oldValue) {
    el.value = oldValue;
  } else {
    el.value = "24;5"; // default value
  }

  if (oldAfcValue) {
    afcEl.value = oldAfcValue;
  } else {
    afcEl.value = "20;3"; // default value
  }

  toggleRxBwOptions();
}

function toggleRxBwOptions() {
  const el = formElements['rx_bw'];
  const afcEl = formElements['afc_bw'];

  const modulation = formElements['modulation'].value;

  const optionCount = el.options.length;

  for (let i=0; i < 3; i++) {
    el.options[i].disabled = (modulation == MOD_FSK);
    el.options[optionCount - 1 - i].disabled = (modulation != MOD_FSK);

    afcEl.options[i].disabled = (modulation == MOD_FSK);
    afcEl.options[optionCount - 1 - i].disabled = (modulation != MOD_FSK);
  }

  checkBw(el);
  checkBw(afcEl);
}

function toggleDataModeSettings() {
  const mode = formElements['data_mode'].value;

  if (mode == MODE_PCKT) {
    showByClassName("PktModeOnly");
    hideByClassName("ContModeOnly");
  } else {
    showByClassName("ContModeOnly");
    hideByClassName("PktModeOnly");
  }
}

function toggleSyncWordSettings() {
  const el = document.getElementById("syncWordSettings");

  const value = formElements['sync_on'].checked;

  if (value) {
    el.style.display = null;
  } else {
    el.style.display = "none";
  }
}

function updateSyncValueLimits() {
  const el = formElements['sync_value'];
  const syncSize = parseFloat(formElements['sync_size'].value);

  if (formElements['sync_size'].validity.valid) {
    el.minLength = 0; // Make sure minLength < MaxLength at all time
    el.maxLength = syncSize * 2;
    el.minLength = syncSize * 2;
    el.pattern = "([0-9A-Fa-f]{2}){" + syncSize + "}"; // Firefox doesn't revalidate the changed length until something is typed. To make sure the length is properly revalidated use a pattern.

    el.value = el.value; // Force validition even if value == default
    el.checkValidity();
  }
}

function checkSyncValue() {
  const el = formElements['sync_value'];

  el.setCustomValidity("");

  if (!el.validity.valid) return; // already invalid due to other cause

  // constraint: "SyncValue choices containing 0x00 bytes are not allowed"
  let isValid = true;
  for (let i = 0; i < el.value.length; i += 2) {
    if (el.value.substr(i, 2) === "00") {
      isValid = false;
      break;
    }
  }

  if (!isValid) {
    el.setCustomValidity("Sync Word may not contain a 0x00 byte");
  }
}

function updatePayloadMsgLenLimits() {
  const el = formElements['payload_msg_len'];
  const pktFmt = parseInt(formElements['packet_format'].value);
  const aesOn = formElements['aes_on'].checked;
  const addrFiltOn = (formElements['address_filtering'].value != ADDR_FILT_NONE);

  // Maximum
  let maxLen = 0;
  if (aesOn) {
    maxLen = 64;
    if (pktFmt == FMT_VAR_LEN && addrFiltOn) {
      maxLen = 48; // See page 57 of datasheet
    }
  } else {
    maxLen = 255;
    if (pktFmt == FMT_VAR_LEN) {
      maxLen -= 1;
    }
    if (addrFiltOn) {
      maxLen -= 1;
    }
  }
  el.max = maxLen;

  // Minimum
  if (addrFiltOn) {
    el.min = 0;
  } else {
    el.min = 1;
  }

  el.checkValidity();
}

function togglePacketFormatSettings() {
  const pktLenSettings = document.getElementById("pktLenSettings");
  const varLenLabel = document.getElementById("lblPktLenVar");
  const fixLenLabel = document.getElementById("lblPktLenFixed");
  const crcTxOnlyLabel = document.getElementById("lblCrcTxOnly");

  const pktFmt = parseInt(formElements['packet_format'].value);

  switch (pktFmt) {
    case FMT_FIXED_LEN:
      varLenLabel.style.display = "none";
      fixLenLabel.style.display = null;
      crcTxOnlyLabel.style.display = "none";
      pktLenSettings.classList.remove("hidden");
      break;
    case FMT_VAR_LEN:
      varLenLabel.style.display = null;
      fixLenLabel.style.display = "none";
      crcTxOnlyLabel.style.display = "none";
      pktLenSettings.classList.remove("hidden");
      break;
    case FMT_UNLIMITED_LEN:
      crcTxOnlyLabel.style.display = null;
      pktLenSettings.classList.add("hidden");
      break;
    default:
      throw new Error("Invalid value of packet_format select");
  }
}

function toggleUnlimitedLengthConstraintSettings() {
  const pktFmt = parseInt(formElements['packet_format'].value);

  if (pktFmt == FMT_UNLIMITED_LEN) {
    hideByClassName("hideIfUnlimitedLen");

    const syncOn = formElements['sync_on'].checked;
    if (syncOn) {
      showByClassName("hideIfUnlimitedLenWithoutSync");
    } else {
      hideByClassName("hideIfUnlimitedLenWithoutSync");
    }
  } else {
    showByClassName("hideIfUnlimitedLen");
    showByClassName("hideIfUnlimitedLenWithoutSync");
  }
}

function togglePktCrcSettings() {
  const el = document.getElementById("pktCrcSettings");

  const crcOn = formElements['crc_on'].checked;

  if (crcOn) {
    el.style.display = null;
  } else {
    el.style.display = "none";
  }
}

function togglePktAddrFiltSettings() {
  const nodeAddrSettings = document.getElementById("pktNodeAddrSettings");
  const bcastAddrSettings = document.getElementById("pktBcastAddrSettings");
  const filterMode = parseInt(formElements['address_filtering'].value);

  if (filterMode == ADDR_FILT_NODE_BCAST) {
    bcastAddrSettings.style.display = null;
  } else {
    bcastAddrSettings.style.display = "none";
  }

  if (filterMode == ADDR_FILT_NODE ||
      filterMode == ADDR_FILT_NODE_BCAST) {
    nodeAddrSettings.style.display = null;
  } else {
    nodeAddrSettings.style.display = "none";
  }
}

function togglePktAesSettings() {
  const el = document.getElementById("pktAesSettings");

  const aesOn = formElements['aes_on'].checked;

  if (aesOn) {
    el.style.display = null;
  } else {
    el.style.display = "none";
  }
}

function updateInterPacketRxDelayOptions() {
  const el = formElements['inter_packet_rx_delay'];
  const bitRate = parseFloat(formElements['bit_rate'].value);
  const bitTime = 1000 / bitRate;

  const oldValue = el.value;

  el.options.length = 0;

  // Option - None
  let optionNone = document.createElement("OPTION");

  optionNone.value = 12;
  optionNone.text = "No Delay";

  el.appendChild(optionNone);

  // Generate select items
  for (let i = 0; i < 12; i++) {
    let newOption = document.createElement("OPTION");
    const multiplier = Math.pow(2, i);
    const ival = multiplier * bitTime;

    newOption.value = i;
    if (ival < 100) {
      newOption.text = (ival).toPrecision(2) + " ms";
    } else {
      newOption.text = Math.round(ival) + " ms";
    }
    newOption.text += " / " + multiplier + " bit time(s)";

    el.appendChild(newOption);
  }

  // Set Value
  if (oldValue) {
    el.value = oldValue;
  } else {
    el.value = "0"; // default value
  }
}
function toggleAutoModesSettings() {
  const el = document.getElementById("settingsAutoModes");

  const value = formElements['auto_modes_on'].checked;

  if (value) {
    el.style.display = null;
  } else {
    el.style.display = "none";
  }
}

function updateClkOutOptions() {
  const el = formElements['clk_out'];
  const fxo = parseFloat(formElements['fxo'].value) * 1e6;

  const calcClkOut = (fxo, clkOut) => {
      return fxo / Math.pow(2, clkOut);
  };

  const oldValue = el.value;

  // Generate select items
  el.options.length = 0;
  for (let clkOut = 0; clkOut < 6; clkOut++) {
    let newOption = document.createElement("OPTION");
    newOption.value = clkOut;
    newOption.text = (Math.round(calcClkOut(fxo, clkOut) / 1e3) / 1e3) + " MHz";

    el.appendChild(newOption);
  }

  // Option - RC oscillator
  let optionRC = document.createElement("OPTION");
  optionRC.value = 6;
  optionRC.text = "62.5 kHz (RC Oscillator)";

  el.appendChild(optionRC);

  // Option - None
  let optionNone = document.createElement("OPTION");

  optionNone.value = 7;
  optionNone.text = "Disabled";

  el.appendChild(optionNone);

  // Set Value
  if (oldValue) {
    el.value = oldValue;
  } else {
    el.value = "7"; // default value
  }
}

function checkBw(el) {
  if (el instanceof Event) {
    el = el.target;
  }

  if (el.options[el.selectedIndex].disabled) {
    el.setCustomValidity("The current options is not avalable for the selected modulation type");
  } else {
    el.setCustomValidity("");
  }
}

function updateMaxBitRate() {
  const el = formElements['wanted_bit_rate'];

  const modulation = formElements['modulation'].value;
  if (modulation == MOD_FSK) {
    el.max = 300;
  } else {
    el.max = 32.768;
  }
  el.checkValidity();
}

function updateActualBitRate() {
  const el = formElements['bit_rate'];

  const fxo = parseFloat(formElements['fxo'].value) * 1e6;
  const wantedBitRate = parseFloat(formElements['wanted_bit_rate'].value) * 1000;

  el.value = fxo / Math.round(fxo / wantedBitRate);
  el.dispatchEvent(new Event('change'));
}

function dioSelectionChange(evt) {
  const el = evt.target;
  let parentTable = el.parentNode;
  while (parentTable != null &&
      parentTable.tagName.toUpperCase() !== "TABLE") {
    parentTable = parentTable.parentNode;
  }
  if (parentTable) {
    updateDioTableSelection(parentTable);
  }
}

function updateDioTableSelection(table) {
  let body = table.tBodies[0];
  for (const row of body.rows) {
    const button = row.cells[0].childNodes[0];

    if (button.checked) {
      row.classList.add('selected');
    } else {
      row.classList.remove('selected');
    }
  }
}

function dioTableRowClick(evt) {
  const row = evt.currentTarget;
  const button = row.getElementsByTagName('INPUT')[0];

  if (button && ! button.checked) {
    button.checked = true;
    button.dispatchEvent(new Event("change"));
  }
}

function checkCarrierFreq() {
  const el = formElements["carrier_freq"];

  el.setCustomValidity("");

  if (!el.validity.valid) return; // already invalid due to other cause

  const valueMHz = parseFloat(el.value);

  if (! (valueMHz >= 290 && valueMHz <= 340 ||
      valueMHz >= 424 && valueMHz <= 510 ||
      valueMHz >= 862 && valueMHz <= 1020)) {
    el.setCustomValidity("Value must be in one of these ranges: 290-340, 424-510, 862-1020");
  }
}

function updateCarrierFreqMax() {
  const el = formElements['carrier_freq'];

  const fxo = parseFloat(formElements['fxo'].value) * 1e6;
  const fstep = fxo / Math.pow(2, 19);

  const calcMax = Math.floor((fstep * 0xffffff) / 1e6);
  if (calcMax < 1020) {
    el.max = calcMax;
  } else {
    el.max = 1020;
  }
  console.log(calcMax);

  el.value = el.value; // Force validition even if value == default
  el.checkValidity();
}

/*
//TODO: Isn't this constrain already enforced by the range of freqDev and bitrate
function checkFreqDev() {
  const el = document.getElementById("inpRadioFreqDev");

  el.setCustomValidity("");

  if (!el.validity.valid) return; // already invalid due to other cause

  const freqDev = parseFloat(document.getElementById("inpRadioFreqDev").value) * 1000;
  const bitRate = parseFloat(document.getElementById("inpPayloadBitRate").value) * 1000;

  if (freqDev + bitRate / 2 > 500000) {
    el.setCustomValidity("Values don't meet constraint: FDEV + bitrate/2 <= 500 kHz");
  }
}
*/

function updatePktView() {
  const pktFmt = parseInt(formElements['packet_format'].value);

  // Preamble
  const preambleSize = formElements['preamble_size'].value;
  document.getElementById("lblPktPreambleLen").innerText = preambleSize;
  if (preambleSize == 0) {
    document.getElementById("PktViewPreamble").style.display = "none";
  } else {
    document.getElementById("PktViewPreamble").style.display = null;
  }

  // Sync Word
  const syncOn = formElements['sync_on'].checked;
  const syncValue = formElements['sync_value'].value;
  let syncValueStr = "";
  for (let i = 0; i < syncValue.length; i += 2) {
    syncValueStr += "0x" + syncValue.substr(i, 2) + " ";
  }
  document.getElementById("lblPktSyncValue").innerText = syncValueStr;
  if (syncOn) {
    document.getElementById("PktViewSync").style.display = null;
  } else {
    document.getElementById("PktViewSync").style.display = "none";
  }

  // Encoding
  let encoding = formElements['encoding'].value;
  if (pktFmt == FMT_UNLIMITED_LEN && ! syncOn) {
    encoding = ENC_NONE;
  }

  const pktViewEncodedEl = document.getElementById("PktViewEncoded");
  if (encoding == ENC_NONE) {
    pktViewEncodedEl.style.display = "none";
    pktViewEncodedEl.after(document.getElementById("PktViewCrc"));
    pktViewEncodedEl.after(document.getElementById("PktViewPayload"));
  } else {
    pktViewEncodedEl.style.display = null;
    pktViewEncodedEl.appendChild(document.getElementById("PktViewPayload"));
    pktViewEncodedEl.appendChild(document.getElementById("PktViewCrc"));

    if (encoding == ENC_MANCHESTER) {
      document.getElementById("lblPktEncoding").innerText = "Manchester Encoding";
    } else {
      document.getElementById("lblPktEncoding").innerText = "Data Whitening";
    }
  }

  let payloadHdrLen = 0;
  // Length
  if (pktFmt == FMT_VAR_LEN) {
    document.getElementById("PktViewLength").style.display = null;
  } else {
    document.getElementById("PktViewLength").style.display = "none";
  }

  // Address filtering
  let addrFilt = formElements['address_filtering'].value;
  if (pktFmt == FMT_UNLIMITED_LEN && ! syncOn) {
    addrFilt = ADDR_FILT_NONE;
  }

  if (addrFilt == ADDR_FILT_NONE) {
    document.getElementById("PktViewAddress").style.display = "none";
  } else {
    document.getElementById("PktViewAddress").style.display = null;
    payloadHdrLen++;
  }
  
  // Message
  const payloadMsgLen = parseFloat(formElements['payload_msg_len'].value);
  if (payloadMsgLen == 0) {
    document.getElementById("PktViewMsg").style.display = "none";
    document.getElementById("PktViewEncrypted").style.display = "none";
  } else {
    // Payload Message Length Label
    if (pktFmt == FMT_VAR_LEN) {
      document.getElementById("lblPktMsgLen").innerText = "upto " + payloadMsgLen;
    } else if (pktFmt == FMT_UNLIMITED_LEN) {
      document.getElementById("lblPktMsgLen").innerText = "...";
    } else {
      document.getElementById("lblPktMsgLen").innerText = payloadMsgLen;
    }

    // 'AES Encrypted'-Container
    let aesOn = formElements['aes_on'].checked;
    if (pktFmt == FMT_UNLIMITED_LEN) {
      aesOn = false;
    }

    if (aesOn) {
      // AES Padding Length
      const paddedPayloadLen = Math.ceil(payloadMsgLen / AES_BLOCK_SIZE) * AES_BLOCK_SIZE;
      const payloadPadLen = paddedPayloadLen - payloadMsgLen;

      if (pktFmt == FMT_VAR_LEN) {
        document.getElementById("lblPktPadLen").innerText = "upto 15";
      } else {
        document.getElementById("lblPktPadLen").innerText = payloadPadLen;
      }

      // Container visibility
      document.getElementById("PktViewEncrypted").style.display = null;
      document.getElementById("PktViewPadding").before(
          document.getElementById("PktViewMsg"));
      if (pktFmt != FMT_VAR_LEN && payloadPadLen == 0) {
        document.getElementById("PktViewPadding").style.display = "none";
      } else {
        document.getElementById("PktViewPadding").style.display = null;
      }
    } else {
      document.getElementById("PktViewEncrypted").style.display = "none";
      document.getElementById("PktViewEncrypted").before(
          document.getElementById("PktViewMsg"));
    }

    document.getElementById("PktViewMsg").style.display = null;
  }

  // CRC
  if (formElements['crc_on'].checked) {
    document.getElementById("PktViewCrc").style.display = null;
  } else {
    document.getElementById("PktViewCrc").style.display = "none";
  }
}

function updateSvgFskSpectrum() {
  const modFsk = (formElements['modulation'].value == MOD_FSK);
  const carrierFreq = parseFloat(formElements['carrier_freq'].value) * 1e6;

  let freqDev = 0;
  if (modFsk) {
    freqDev = parseFloat(formElements['fdev'].value) * 1000;
  }

  const bitRate = parseFloat(formElements['bit_rate'].value);
  const rxBW = parseFloat(formElements['rx_bw'].options[formElements['rx_bw'].selectedIndex].text) * 1000;
  const afcBW = parseFloat(formElements['afc_bw'].options[formElements['afc_bw'].selectedIndex].text) * 1000;

  const svgEl = document.getElementById("svgSpectrum");


  // Define dimensions
  const xZero = svgEl.getBoundingClientRect().width / 2;
  const xMaxPos = svgEl.getBoundingClientRect().width - 50;
  const xMaxNeg = 50;

  const yZero = 390;
  const yMax = 10;

  // main curve
  let relXCoords = {};
  let bandwidth = 0;
  if (modFsk) {
    relXCoords['mainPeak'] = 0;
    relXCoords['firstLow'] = (bitRate / 2);
    relXCoords['secondPeak'] = relXCoords['firstLow']  + (bitRate / 4);
    relXCoords['secondLow']  = relXCoords['secondPeak']+ (bitRate / 4);
    relXCoords['thirdPeak']  = relXCoords['secondLow'] + (bitRate / 4);
    relXCoords['thirdLow']   = relXCoords['thirdPeak'] + (bitRate / 4);
    bandwidth = Math.round((2 * freqDev) + bitRate);
  } else {
    relXCoords['mainPeak'] = 0;
    relXCoords['firstLow'] = bitRate;
    relXCoords['secondPeak'] = relXCoords['firstLow']  + (bitRate / 2);
    relXCoords['secondLow']  = relXCoords['secondPeak']+ (bitRate / 2);
    relXCoords['thirdPeak']  = relXCoords['secondLow'] + (bitRate / 2);
    relXCoords['thirdLow']   = relXCoords['thirdPeak'] + (bitRate / 2);

    bandwidth = Math.round(bitRate);
  }

  // Filter starts
  relXCoords['rxFilterStart'] = rxBW;
  relXCoords['afcFilterStart'] = afcBW;

  // TODO: DCC filter
  
  // Determine Scaling
  let furthestPoint = freqDev + bitRate/2;
  if (rxBW > furthestPoint) {
    furthestPoint = rxBW;
  }
  if (afcBW > furthestPoint) {
    furthestPoint = afcBW;
  }
  const scale = (xMaxPos - xZero) / furthestPoint;
  // TODO: do this more differently, so that the N-th side bands runs till outside of the image...


  let genCurve = function(side, direction) {
    // Generate curve coordinates, for 1/2 curve
    let x = {};
    for (const key in relXCoords) {
      x[key] = xZero +
        (side * freqDev * scale) +
        (direction * (relXCoords[key] * scale));
    }
    const attackMainPeak = direction * bitRate/2 * 0.5 * scale;
    const attackMainLow = direction * bitRate/2 * 0.5 * scale;
    const attackPeak = direction * bitRate/4 * 0.5 * scale;
    const attackLow = direction * bitRate/4 * 0.5 * scale;

    return (
        "M "  +  x['mainPeak']         + " " + yMax +
        " C " + (x['mainPeak'] + attackMainPeak)   + " " + yMax +
        " , " + (x['firstLow'] - attackLow)   + " " + yZero +
        " , " +  x['firstLow']         + " " + yZero +
        " S " + (x['secondPeak'] - attackPeak) + " " + (yZero + (yMax - yZero) * 0.10) +
        " , " +  x['secondPeak']       + " " + (yZero + (yMax - yZero) * 0.10) +
        " S " + (x['secondLow'] - attackLow)  + " " + yZero +
        " , " +  x['secondLow']        + " " + yZero +
        " S " + (x['thirdPeak'] - attackPeak)  + " " + (yZero + (yMax - yZero) * 0.05) +
        " , " +  x['thirdPeak']        + " " + (yZero + (yMax - yZero) * 0.05) +
        " S " + (x['thirdLow'] - attackLow)   + " " + yZero +
        " , " +  x['thirdLow']         + " " + yZero);
  };

  document.getElementById("curvePosRight").setAttribute("d", genCurve(1, 1));
  document.getElementById("curvePosLeft").setAttribute("d", genCurve(1, -1));
  document.getElementById("curveNegRight").setAttribute("d", genCurve(-1, 1));
  document.getElementById("curveNegLeft").setAttribute("d", genCurve(-1, -1));

  // Set Receive Filter Coordinates
  document.getElementById("rectRxFiltPos").setAttribute("x", xZero + relXCoords['rxFilterStart'] * scale);
  document.getElementById("rectRxFiltNeg").setAttribute("width", xZero - relXCoords['rxFilterStart'] * scale);

  // Set AFC Filter Coordinates
  document.getElementById("rectAfcFiltPos").setAttribute("x", xZero + relXCoords['afcFilterStart'] * scale);
  document.getElementById("rectAfcFiltNeg").setAttribute("width", xZero - relXCoords['afcFilterStart'] * scale);

  // Update frequencies labels
  document.getElementById("lblFreqLow").innerHTML = ((carrierFreq - freqDev) / 1e6).toFixed(3);
  document.getElementById("lblFreqLow").setAttribute("x", xZero - freqDev * scale);
  document.getElementById("lineFreqLow").setAttribute("x1", xZero - freqDev * scale);
  document.getElementById("lineFreqLow").setAttribute("x2", xZero - freqDev * scale);

  document.getElementById("lblFreqHigh").innerHTML = ((carrierFreq + freqDev) / 1e6).toFixed(3);
  document.getElementById("lblFreqHigh").setAttribute("x", xZero + freqDev * scale);
  document.getElementById("lineFreqHigh").setAttribute("x1", xZero + freqDev * scale);
  document.getElementById("lineFreqHigh").setAttribute("x2", xZero + freqDev * scale);

  // Update (Carson) Bandwidth Text and Arrow
  document.getElementById("lblFreqBWLow").innerHTML = ((carrierFreq - bandwidth/2) / 1e6).toFixed(3);
  document.getElementById("lblFreqBWLow").setAttribute("x", xZero - (bandwidth/2) * scale);
  document.getElementById("lblFreqBWHigh").innerHTML = ((carrierFreq + bandwidth/2) / 1e6).toFixed(3);
  document.getElementById("lblFreqBWHigh").setAttribute("x", xZero + (bandwidth/2) * scale);

  if (!modFsk) {
    document.getElementById("lineBWMarkLeft").setAttribute("x1", xZero - (bandwidth/2) * scale);
    document.getElementById("lineBWMarkLeft").setAttribute("x2", xZero - (bandwidth/2) * scale);
    document.getElementById("lineBWMarkRight").setAttribute("x1", xZero + (bandwidth/2) * scale);
    document.getElementById("lineBWMarkRight").setAttribute("x2", xZero + (bandwidth/2) * scale);
  }

  document.getElementById("lblBW20dB").innerHTML = "BW = " + (bandwidth / 1000) + " kHz";

  const calcArrowPoints = (xPoint, yCenter, direction) => {
    return xPoint + "," + yCenter + " " +
      (xPoint + (direction * 10))  + "," + (yCenter - 5) + " " +
      (xPoint + (direction * 7.5)) + "," + yCenter + " " +
      (xPoint + (direction * 10))  + "," + (yCenter + 5);
  };
  document.getElementById("arrowBWLeft").setAttribute("points", calcArrowPoints(xZero - (freqDev + bitRate/2) * scale, 430, 1));
  document.getElementById("arrowBWRight").setAttribute("points", calcArrowPoints(xZero + (freqDev + bitRate/2) * scale, 430, -1));
  document.getElementById("lineBW").setAttribute("x1", xZero - (freqDev + bitRate/2) * scale + 2);
  document.getElementById("lineBW").setAttribute("x2", xZero + (freqDev + bitRate/2) * scale - 2);
}

function importRegValues() {
  const form = document.getElementById("frmSettings");

  const lines = document.getElementById("txtRegVal").value.split('\n');

  let regs = {};
  for (let i=0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === "") {
      continue;
    }

    const regexMatch = line.match(/^([0-9a-fA-F]{2})\s+([0-9a-fA-F]{2})$/);
    if (!regexMatch) {
      throw new Error("Line " + (i+1) + ": Syntax Error");
    }

    const addr = parseInt(regexMatch[1], 16);
    if (addr < 0 || addr > 0xff) {
      throw new Error("Line " + (i+1) + ": Address out of range");
    }

    const val = parseInt(regexMatch[2], 16);
    if (val < 0 || val > 0xff) {
      throw new Error("Line " + (i+1) + ": Value out of range");
    }

    regs[addr] = val;
  }

  const fxOsc = parseFloat(formElements['fxo'].value) * 1e6;
  const fstep = fxOsc / Math.pow(2, 19);

  let val;

  // (0x02) RegDataModul
  if (0x02 in regs) {
    switch ((regs[0x02] >> 3) & 0x3) {
      case 0:
        formElements['modulation'].value = MOD_FSK;
        break;
      case 1:
        formElements['modulation'].value = MOD_OOK;
        break;
      default:
        throw new Error("[0x02.ModulationType] Invalid Value");
    }
    formElements['modulation'].dispatchEvent(new Event('change'));

    formElements['modulation_shaping'].value = (regs[0x02] & 0x03);
    formElements['modulation_shaping'].dispatchEvent(new Event('change'));

    formElements['bit_sync_on'].checked = true;
    switch ((regs[0x02] >> 5) & 0x3) {
      case 0:
        formElements['data_mode'].value = MODE_PCKT;
        break;
      case 3:
        formElements['bit_sync_on'].checked = false;
      case 2:
        formElements['data_mode'].value = MODE_CONT;
        break;
      default:
        throw new Error("[0x02.DataMode] Invalid Value");
    }
    formElements['bit_sync_on'].dispatchEvent(new Event('change'));
  }

  // (0x03-0x04) RegBitrate*
  if (0x03 in regs && 0x04 in regs) {
    if (regs[0x03] + regs[0x04] === 0) {
      throw new Error("[0x03-0x04] Invalid bitrate");
    }
    formElements['wanted_bit_rate'].value = Math.round(fxOsc / (regs[0x03] << 8 | regs[0x04])) / 1000;
    formElements['wanted_bit_rate'].dispatchEvent(new Event('change'));
  }

  // (0x05-0x06) RegFdev*
  if (0x05 in regs && 0x06 in regs) {
    formElements['fdev'].value = Math.round(fstep * (regs[0x05] << 8 | regs[0x06])) / 1000;
    formElements['fdev'].dispatchEvent(new Event('change'));
  }

  // (0x07-0x09) RegFrf
  if (0x07 in regs && 0x08 in regs && 0x09 in regs) {
    formElements['carrier_freq'].value = Math.round(fstep * 
          (regs[0x07] << 16 | regs[0x08] << 8 | regs[0x09])) / 1e6;
    formElements['carrier_freq'].dispatchEvent(new Event('change'));
  }

  // (0x0A) RegAfcCtrl
  if (0x0a in regs) {
    formElements['afc_low_beta_on'].checked = regs[0x0a] & 0x20;
    formElements['afc_low_beta_on'].dispatchEvent(new Event('change'));
  }

  // (0x11) RegPaLevel
  if (0x11 in regs) {
    if (regs[0x11] & 0x80) {
      // PA0 enabled
      formElements['tx_pin_select'].value = 0;
    } else {
      // PA1 enabled
      formElements['tx_pin_select'].value = 1;
    }

    let paPower = -18 + (regs[0x11] & 0x1f);
    if (regs[0x11] & 0x20) {
      // PA2 enabled
      paPower += 4;
    }
    formElements['pa_power'].value = paPower;

    formElements['pa_power'].dispatchEvent(new Event('change'));
    formElements['tx_pin_select'].dispatchEvent(new Event('change'));
  }

  // (0x12) RegPaRamp
  if (0x12 in regs) {
    formElements['pa_ramp'].value = regs[0x12] & 0x0f;
    formElements['pa_ramp'].dispatchEvent(new Event('change'));
  }

  // (0x13) RegOcp
  if (0x13 in regs) {
    formElements['ocp_on'].checked = regs[0x13] & 0x10;
    formElements['ocp_on'].dispatchEvent(new Event('change'));

    formElements['ocp_imax'].value = 45 + 5 * (regs[0x13] & 0x0f);
    formElements['ocp_imax'].dispatchEvent(new Event('change'));
  }

  // (0x18) RegLna
  if (0x18 in regs) {
    formElements['lna_gain_select'].value = regs[0x18] & 0x07;
    formElements['lna_gain_select'].dispatchEvent(new Event('change'));

    formElements['lna_zin'].value = (regs[0x18] & 0x80) ? 1 : 0;
    formElements['lna_zin'].dispatchEvent(new Event('change'));
  }

  // (0x19) RegRxBw
  if (0x19 in regs) {
    let rxBwMant = 0;
    switch ((regs[0x19] >> 3) & 0x3) {
      case 0:
        rxBwMant = 16;
        break;
      case 1:
        rxBwMant = 20;
        break;
      case 2:
        rxBwMant = 24;
        break;
      default:
        throw new Error("[0x19.RxBwMant] Invalid value");
    }

    formElements['rx_bw'].value = rxBwMant + ";" + (regs[0x19] & 0x7);
    formElements['rx_bw'].dispatchEvent(new Event('change'));

    formElements['dcc_freq'].value = (regs[0x19] >>> 5) & 0x7;
    formElements['dcc_freq'].dispatchEvent(new Event('change'));
  }

  // (0x1a) RegAfcBw
  if (0x1a in regs) {
    let rxBwMant = 0;
    switch ((regs[0x1a] >> 3) & 0x3) {
      case 0:
        rxBwMant = 16;
        break;
      case 1:
        rxBwMant = 20;
        break;
      case 2:
        rxBwMant = 24;
        break;
      default:
        throw new Error("[0x1a.RxBwMant] Invalid value");
    }

    formElements['afc_bw'].value = rxBwMant + ";" + (regs[0x1a] & 0x7);
    formElements['afc_bw'].dispatchEvent(new Event('change'));

    formElements['dcc_freq_afc'].value = (regs[0x1a] >>> 5) & 0x7;
    formElements['dcc_freq_afc'].dispatchEvent(new Event('change'));
  }

  // (0x1b) RegOokPeak
  if (0x1b in regs) {
    formElements['ook_thresh_type'].value = (regs[0x1b] >>> 6) & 0x3;
    formElements['ook_thresh_type'].dispatchEvent(new Event('change'));
    formElements['ook_peak_thresh_step'].value = (regs[0x1b] >>> 3) & 0x7;
    formElements['ook_peak_thresh_step'].dispatchEvent(new Event('change'));
    formElements['ook_peak_thresh_dec'].value = regs[0x1b] & 0x7;
    formElements['ook_peak_thresh_dec'].dispatchEvent(new Event('change'));
  }

  // (0x1c) RegOokAvg
  if (0x1c in regs) {
    formElements['ook_average_thresh_fit'].value = (regs[0x1c] >>> 6) & 0x3;
    formElements['ook_average_thresh_fit'].dispatchEvent(new Event('change'));
  }

  // (0x1d) RegOokFix
  if (0x1d in regs) {
    formElements['ook_peak_thresh_floor'].value =
      formElements['ook_fixed_thresh'].value = 
      regs[0x1d];
    formElements['ook_peak_thresh_floor'].dispatchEvent(new Event('change'));
    formElements['ook_fixed_thresh'].dispatchEvent(new Event('change'));
  }

  // (0x1e) RegAfcFei
  if (0x1e in regs) {
    formElements['afc_auto_on'].checked = regs[0x1e] & 0x04;
    formElements['afc_auto_on'].dispatchEvent(new Event('change'));

    formElements['afc_auto_clear_on'].checked = regs[0x1e] & 0x08;
    formElements['afc_auto_clear_on'].dispatchEvent(new Event('change'));
  }

  // (0x25) RegDioMapping1
  if (0x25 in regs) {
    val = (regs[0x25] >>> 6) & 0x3;
    formElements['dio_0_mapping_cont'].value = val;
    formElements['dio_0_mapping_pkt'].value = val;
    formElements['dio_0_mapping_cont'][val].dispatchEvent(new Event('change'));
    formElements['dio_0_mapping_pkt'][val].dispatchEvent(new Event('change'));

    val = (regs[0x25] >>> 4) & 0x3;
    formElements['dio_1_mapping_cont'].value = val;
    formElements['dio_1_mapping_pkt'].value = val;
    formElements['dio_1_mapping_cont'][val].dispatchEvent(new Event('change'));
    formElements['dio_1_mapping_pkt'][val].dispatchEvent(new Event('change'));

    val = (regs[0x25] >>> 2) & 0x3;
    formElements['dio_2_mapping_cont'].value = val;
    formElements['dio_2_mapping_pkt'].value = val;
    formElements['dio_2_mapping_cont'][val].dispatchEvent(new Event('change'));
    formElements['dio_2_mapping_pkt'][val].dispatchEvent(new Event('change'));

    val = regs[0x25] & 0x3;
    formElements['dio_3_mapping_cont'].value = val;
    formElements['dio_3_mapping_pkt'].value = val;
    formElements['dio_3_mapping_cont'][val].dispatchEvent(new Event('change'));
    formElements['dio_3_mapping_pkt'][val].dispatchEvent(new Event('change'));
  }

  // (0x26) RegDioMapping1
  if (0x26 in regs) {
    val = (regs[0x26] >>> 6) & 0x3;
    formElements['dio_4_mapping_cont'].value = val;
    formElements['dio_4_mapping_pkt'].value = val;
    formElements['dio_4_mapping_cont'][val].dispatchEvent(new Event('change'));
    formElements['dio_4_mapping_pkt'][val].dispatchEvent(new Event('change'));

    val = (regs[0x26] >>> 4) & 0x3;
    formElements['dio_5_mapping_cont'].value = val;
    formElements['dio_5_mapping_pkt'].value = val;
    formElements['dio_5_mapping_cont'][val].dispatchEvent(new Event('change'));
    formElements['dio_5_mapping_pkt'][val].dispatchEvent(new Event('change'));

    formElements['clk_out'].value = regs[0x26] & 0x7;
  }

  // (0x29) RegRssiThresh
  formElements['rssi_threshold'].value = regs[0x29] / -2;
  formElements['rssi_threshold'].dispatchEvent(new Event('change'));

  // (0x2a) RegRxTimeout1
  // TODO:

  // (0x2b) RegRxTimeout2
  // TODO:

  // (0x2c-0x2d) RegPreamble
  if (0x2c in regs && 0x2d in regs) {
    formElements['preamble_size'].value = (regs[0x2c] << 8) | regs[0x2d];
    formElements['preamble_size'].dispatchEvent(new Event('change'));
  }

  // (0x2e) RegSyncConf
  if (0x2e in regs) {
    formElements['sync_on'].checked = (regs[0x2e] & 0x80);
    formElements['sync_on'].dispatchEvent(new Event('change'));

    formElements['fifo_fill_condition'].value = (regs[0x2e] >>> 6) & 0x01;
    formElements['fifo_fill_condition'].dispatchEvent(new Event('change'));

    formElements['sync_size'].value = 1 + ((regs[0x2e] >>> 3) & 0x07);
    formElements['sync_size'].dispatchEvent(new Event('change'));

    formElements['sync_tol'].value = regs[0x2e] & 0x07;
    formElements['sync_tol'].dispatchEvent(new Event('change'));
  }

  // (0x2f-0x36) RegSyncValue
  if (formElements['sync_on'].checked) {
    const syncSize = parseInt(formElements['sync_size'].value);

    let syncValue = "";
    let setValue = false;
    for (let i=0; i < syncSize; i++) {
      if ((0x2f + i) in regs) {
        setValue = true;
        syncValue += bToHexStr(regs[0x2f + i]);
      } else {
        syncValue += "01";
      }
    }
    if (setValue) {
      formElements['sync_value'].value = syncValue;
      formElements['sync_value'].dispatchEvent(new Event('change'));
    }
  }

  // (0x37) RegPacketConfig1
  if (0x37 in regs) {
    formElements['address_filtering'].value = (regs[0x37] >>> 1) & 0x03;
    formElements['address_filtering'].dispatchEvent(new Event('change'));

    formElements['encoding'].value = (regs[0x37] >>> 5) & 0x03;
    formElements['encoding'].dispatchEvent(new Event('change'));

    if (regs[0x37] & 0x80) {
      formElements['packet_format'].value = FMT_VAR_LEN;
    } else {
      formElements['packet_format'].value = FMT_FIXED_LEN;
    }
    formElements['packet_format'].dispatchEvent(new Event('change'));

    formElements['crc_on'].checked = regs[0x37] & 0x10;
    formElements['crc_on'].dispatchEvent(new Event('change'));

    formElements['crc_auto_clear_off'].checked = regs[0x37] & 0x08;
    formElements['crc_auto_clear_off'].dispatchEvent(new Event('change'));
  }

  // (0x38) RegPayloadLength
  if (0x38 in regs) {
    const payloadLen = regs[0x38];
    const pktFmt = formElements['packet_format'].value;

    if (pktFmt == FMT_FIXED_LEN && payloadLen == 0) {
      formElements['packet_format'].value = FMT_UNLIMITED_LEN;
      formElements['packet_format'].dispatchEvent(new Event('change'));
    }

    let payloadMsgLen = payloadLen;
    if (formElements['address_filtering'].value != ADDR_FILT_NONE) {
      payloadMsgLen -= 1;
    }
    if (pktFmt == FMT_VAR_LEN) {
      payloadMsgLen -= 1;
    }

    formElements['payload_msg_len'].value = payloadMsgLen;
    formElements['payload_msg_len'].dispatchEvent(new Event('change'));
  }

  // (0x39) RegNodeAdrs
  if (0x39 in regs) {
    formElements['node_address'].value = regs[0x39];
    formElements['node_address'].dispatchEvent(new Event('change'));
  }

  // (0x3a) RegBroadcastAdrs
  if (0x3a in regs) {
    formElements['broadcast_address'].value = regs[0x3a];
    formElements['broadcast_address'].dispatchEvent(new Event('change'));
  }

  // (0x3b) RegAutoModes
  if (0x3b in regs) {
    const enterCondition = (regs[0x3b] >>> 5) & 0x7;
    const exitCondition = (regs[0x3b] >>> 2) & 0x7;

    formElements['auto_modes_on'].checked = (enterCondition !== 0 && exitCondition !== 0);
    formElements['auto_modes_on'].dispatchEvent(new Event('change'));

    formElements['am_enter_condition'].value = enterCondition;
    formElements['am_enter_condition'].dispatchEvent(new Event('change'));

    formElements['am_exit_condition'].value = exitCondition;
    formElements['am_exit_condition'].dispatchEvent(new Event('change'));

    formElements['am_intermediate_mode'].value = regs[0x3b] & 0x3;
    formElements['am_intermediate_mode'].dispatchEvent(new Event('change'));
  }

  // (0x3c) RegFifoThresh
  if (0x3c in regs) {
    formElements['tx_start_condition'].value = (regs[0x3c] >>> 7) & 0x01;
    formElements['tx_start_condition'].dispatchEvent(new Event('change'));

    formElements['fifo_threshold'].value = regs[0x3c] & 0x7f;
    formElements['fifo_threshold'].dispatchEvent(new Event('change'));
  }

  // (0x3d) RegPacketConfig2
  if (0x3d in regs) {
    formElements['inter_packet_rx_delay'].value = regs[0x3d] >>> 4;
    formElements['inter_packet_rx_delay'].dispatchEvent(new Event('change'));

    formElements['auto_rx_restart_on'].checked = regs[0x3d] & 0x02;
    formElements['auto_rx_restart_on'].dispatchEvent(new Event('change'));

    formElements['aes_on'].checked = regs[0x3d] & 0x01;
    formElements['aes_on'].dispatchEvent(new Event('change'));
  }

  // (0x3e-0x4d) RegAesKey
  if (0x3e in regs && 0x3f in regs && 0x40 in regs && 0x41 in regs &&
      0x42 in regs && 0x43 in regs && 0x44 in regs && 0x45 in regs &&
      0x46 in regs && 0x47 in regs && 0x48 in regs && 0x49 in regs &&
      0x4a in regs && 0x4b in regs && 0x4c in regs && 0x4d in regs) {
    let aesKey = "";
    for (let addr=0x3e; addr <= 0x4d; addr++) {
      aesKey += bToHexStr(regs[addr]);
    }
    formElements['aes_key'].value = aesKey;
    formElements['aes_key'].dispatchEvent(new Event('change'));
    aesKey = undefined;
  }

  // (0x58) RegTestLna
  if (0x58 in regs) {
    formElements['sensitivity_boost'].checked = (regs[0x58] == 0x2d);
  }

  // (0x59) RegTestTcxo
  if (0x59 in regs) {
    formElements['tcxo_input_on'].checked = (regs[0x59] & 0x10);
  }

  // (0x5f) RegTestPIIBW
  // TODO:

  // (0x6f) RegTestDagc
  if (0x6f in regs) {
    formElements['dagc_on'].checked = (regs[0x6f] != 0x00);
  }

  // (0x71) RegTestAfc
  if (0x71 in regs) {
    formElements['low_beta_afc_offset'].value = regs[0x71] * 488;
  }
}

function generateRegValues() {
  const regs = {};

  const fxOsc = parseFloat(formElements['fxo'].value) * 1e6;
  const fstep = fxOsc / Math.pow(2, 19);

  const mod = parseInt(formElements['modulation'].value);
  const pktFmt = parseInt(formElements['packet_format'].value);
  const dataMode = parseInt(formElements['data_mode'].value);
  const addrFilt = formElements['address_filtering'].disabled ? ADDR_FILT_NONE : parseInt(formElements['address_filtering'].value);

  // (0x02) RegDataModul
  regs[0x02] = parseInt(formElements['modulation_shaping'].value);
  if (dataMode == MODE_CONT) {
    regs[0x02] |= 0x40;
    if (! formElements['bit_sync_on'].checked) {
      regs[0x02] |= 0x20;
    }
  }
  if (mod == MOD_OOK) {
    regs[0x02] |= 0x08;
  }

  // (0x03-0x04) RegBitrate*
  const bitrate = Math.round(fxOsc / parseFloat(formElements['bit_rate'].value));
  regs[0x03] = (bitrate >>> 8) & 0xff;
  regs[0x04] = bitrate & 0xff;

  // (0x05-0x06) RegFdev*
  if (mod == MOD_FSK) {
    const fdev = Math.round(parseFloat(formElements['fdev'].value) * 1000 / fstep);
    regs[0x05] = (fdev >>> 8) & 0x3f;
    regs[0x06] = fdev & 0xff;
  }

  // (0x07-0x09) RegFrf
  const fcarrier = Math.round(parseFloat(formElements['carrier_freq'].value) * 1e6 / fstep);
  regs[0x07] = (fcarrier >>> 16) & 0xff;
  regs[0x08] = (fcarrier >>> 8) & 0xff;
  regs[0x09] = fcarrier & 0xff;

  // (0x0B) RegAfcCtrl
  const afcLowBetaOn = ( !formElements['afc_low_beta_on'].disabled &&
      formElements['afc_low_beta_on'].checked);
  if (afcLowBetaOn) {
    regs[0x0b] = 0x20;
  } else {
    regs[0x0b] = 0;
  }

  // (0x11) RegPaLevel
  let paPower = parseFloat(formElements['pa_power'].value);
  if (formElements['tx_pin_select'].value == 0) {
    regs[0x11] = 0x80; // Enable PA0
  } else {
    regs[0x11] = 0x40; // Enable PA1
  }
  if (paPower > 13) {
    paPower -= 4;
    regs[0x11] |= 0x20; // Enable PA2
  }
  regs[0x11] |= (paPower + 18) & 0x1f;

  // (0x12) RegPaRamp
  regs[0x12] = parseInt(formElements['pa_ramp'].value) & 0x0f;

  // (0x13) RegOcp
  if (formElements['ocp_on'].checked) {
    regs[0x13] = 0x10;
    regs[0x13] |= Math.round((parseFloat(formElements['ocp_imax'].value) - 45) / 5) & 0x0f;
  } else {
    regs[0x13] = 0x0a;
  }

  // (0x18) RegLna
  regs[0x18] = parseInt(formElements['lna_gain_select'].value) & 0x7;
  regs[0x18] |= 0x08;
  if (formElements['lna_zin'].value == 1) {
    regs[0x18] |= 0x80;
  }

  // (0x19) RegRxBw
  const rxBwParts = formElements['rx_bw'].value.split(';');
  if (rxBwParts.length != 2) {
      throw new Error("Invalid RxBw value format");
  }

  let rxBwMant = 0;
  switch (parseInt(rxBwParts[0])) {
    case 16:
      rxBwMant = 0;
      break;
    case 20:
      rxBwMant = 1;
      break;
    case 24:
      rxBwMant = 2;
      break;
    default:
      throw new Error("Invalid RxBw Mant.");
  }
  const rxBwExp = parseInt(rxBwParts[1]);

  regs[0x19] = (parseInt(formElements['dcc_freq'].value) << 5) |
      (rxBwMant << 3) | (rxBwExp & 0x7);

  // (0x1a) RegAfcBw
  const afcBwParts = formElements['afc_bw'].value.split(';');
  if (afcBwParts.length != 2) {
      throw new Error("Invalid AfcBw value format");
  }

  let afcBwMant = 0;
  switch (parseInt(afcBwParts[0])) {
    case 16:
      afcBwMant = 0;
      break;
    case 20:
      afcBwMant = 1;
      break;
    case 24:
      afcBwMant = 2;
      break;
    default:
      throw new Error("Invalid AfcBw Mant.");
  }
  const afcBwExp = parseInt(afcBwParts[1]);

  regs[0x1a] = (parseInt(formElements['dcc_freq_afc'].value) << 5) |
      (afcBwMant << 3) | (afcBwExp & 0x7);

  if (mod == MOD_OOK) {
    // (0x1b) RegOokPeak
    const ookThreshType = parseInt(formElements['ook_thresh_type'].value);
    regs[0x1b] = ookThreshType << 6;
    if (ookThreshType == 1) {
      regs[0x1b] |= parseInt(formElements['ook_peak_thresh_step'].value) << 3;
      regs[0x1b] |= parseInt(formElements['ook_peak_thresh_dec'].value);
    }

    // (0x1c) RegOokAvg
    if (ookThreshType == 2) {
      regs[0x1c] = parseInt(formElements['ook_average_thresh_fit'].value) << 6;
    }

    // (0x1d) RegOokFix
    if (ookThreshType == 1) {
      regs[0x1d] = parseFloat(formElements['ook_peak_thresh_floor'].value) & 0xff;
    } else if (ookThreshType == 0) {
      regs[0x1d] = parseFloat(formElements['ook_fixed_thresh'].value) & 0xff;
    }
  }

  // (0x1e) RegAfcFei
  regs[0x1e] = 0x10;
  if (formElements['afc_auto_on'].checked) {
    regs[0x1e] |= 0x04;
  }
  if (formElements['afc_auto_clear_on'].checked) {
    regs[0x1e] |= 0x08;
  }

  // (0x25) RegDioMapping1
  const modeSuffix = (dataMode == MODE_PCKT) ? "pkt" : "cont";
  regs[0x25] = 
    parseInt(formElements['dio_0_mapping_' + modeSuffix].value) << 6 |
    parseInt(formElements['dio_1_mapping_' + modeSuffix].value) << 4 |
    parseInt(formElements['dio_2_mapping_' + modeSuffix].value) << 2 |
    parseInt(formElements['dio_3_mapping_' + modeSuffix].value);

  // (0x26) RegDioMapping2
  regs[0x26] = 
    parseInt(formElements['dio_4_mapping_' + modeSuffix].value) << 6 |
    parseInt(formElements['dio_5_mapping_' + modeSuffix].value) << 4 |
    parseInt(formElements['clk_out'].value);

  // (0x29) RegRssiThresh
  regs[0x29] = parseFloat(formElements['rssi_threshold'].value) * -2;

  // (0x2a) RegRxTimeout1
  // TODO:

  // (0x2b) RegRxTimeout2
  // TODO:


  if (dataMode == MODE_PCKT) {
    // (0x2c-0x2d) RegPreamble
    const preambleLen = parseFloat(formElements['preamble_size'].value);
    regs[0x2c] = (preambleLen >> 8);
    regs[0x2d] = (preambleLen & 0xff);

    // (0x2e) RegSyncConf
    let syncSize = 0;
    if (formElements['sync_on'].checked) {
      syncSize = parseFloat(formElements['sync_size'].value);

      regs[0x2e] = 0x80;
      regs[0x2e] |= ((syncSize - 1) & 0x07) << 3;
      regs[0x2e] |= parseFloat(formElements['sync_tol'].value) & 0x07;
    } else {
      regs[0x2e] = 0x18;
    }
    if (formElements['fifo_fill_condition'].value != 0) {
      regs[0x2e] |= 0x40;
    }

    // (0x2f-0x36) RegSyncValue
    const syncValue = formElements['sync_value'].value;
    for (let i=0; i < syncSize; i++) {
      regs[0x2f + i] = parseInt(syncValue.substr(i*2, 2), 16);
    }

    // (0x37) RegPacketConfig1
    regs[0x37] = addrFilt << 1;
    if (!formElements['encoding'].disabled) {
      regs[0x37] |= parseInt(formElements['encoding'].value) << 5;
    }
    if (pktFmt == FMT_VAR_LEN) {
      regs[0x37] |= 0x80;
    }
    if (formElements['crc_on'].checked) {
      regs[0x37] |= 0x10;
    }
    if (!formElements['crc_auto_clear_off'].disabled &&
        formElements['crc_auto_clear_off'].checked) {
      regs[0x37] |= 0x08;
    }

    // (0x38) RegPayloadLength
    if (pktFmt == FMT_UNLIMITED_LEN) {
      regs[0x38] = 0;
    } else {
      let payloadLen = parseFloat(formElements['payload_msg_len'].value);
      if (addrFilt != ADDR_FILT_NONE) {
        payloadLen += 1;
      }
      if (pktFmt == FMT_VAR_LEN) {
        payloadLen += 1;
      }

      regs[0x38] = payloadLen;
    }

    // (0x39) RegNodeAdrs
    if (addrFilt != ADDR_FILT_NONE) {
      regs[0x39] = parseInt(formElements['node_address'].value);
    }

    // (0x3a) RegBroadcastAdrs
    if (addrFilt == ADDR_FILT_NODE_BCAST) {
      regs[0x3a] = parseInt(formElements['broadcast_address'].value);
    }

    // (0x3b) RegAutoModes
    if (formElements['auto_modes_on'].checked) {
      regs[0x3b] = formElements['am_intermediate_mode'].value & 0x3;
      regs[0x3b] |= (formElements['am_exit_condition'].value & 0x7) << 2;
      regs[0x3b] |= (formElements['am_enter_condition'].value & 0x7) << 5;
    }

    // (0x3c) RegFifoThresh
    regs[0x3c] = parseFloat(formElements['fifo_threshold'].value) & 0x7f;
    if (formElements['tx_start_condition'].value == 1) {
      regs[0x3c] |= 0x80;
    }

    // (0x3d) RegPacketConfig2
    regs[0x3d] = parseInt(formElements['inter_packet_rx_delay'].value) << 4;
    if (formElements['auto_rx_restart_on'].checked) {
      regs[0x3d] |= 0x02;
    }
    const aesOn = (!formElements['aes_on'].disabled &&
        formElements['aes_on'].checked);
    if (aesOn) {
      regs[0x3d] |= 0x01;
    }

    // (0x3e-0x4d) RegAesKey
    if (aesOn) {
      let aesKey = formElements['aes_key'].value;
      for (let i=0; i < 16; i++) {
        regs[0x3e + i] = parseInt(aesKey.substr(2*i, 2), 16);
      }
      aesKey = undefined;
    }
  }

  // (0x58) RegTestLna
  if (formElements['sensitivity_boost'].checked) {
    regs[0x58] = 0x2d;
  } else {
    regs[0x58] = 0x1b;
  }

  // (0x59) RegTestTcxo
  regs[0x59] = 0x09;
  if (formElements['tcxo_input_on'].checked) {
    regs[0x59] |= 0x10;
  }

  // (0x5f) RegTestPIIBW
  // TODO:

  // (0x6f) RegTestDagc
  if (formElements['dagc_on'].checked) {
    if (afcLowBetaOn) {
      regs[0x6f] = 0x20;
    } else {
      regs[0x6f] = 0x30;
    }
  } else {
    regs[0x6f] = 0x00;
  }

  // (0x71) RegTestAfc
  if (afcLowBetaOn) {
    const afcOffset = parseFloat(formElements['low_beta_afc_offset'].value);
    regs[0x71] = Math.round(afcOffset / 488);
  }

  return regs;
}

var prevRegs = POR_REGS;

function updateRegisterDebugView() {
  const form = document.getElementById("frmSettings");
  const table = document.getElementById("tblRegisterDebugView");
  const newBody = document.createElement("TBODY");

  formUpdateDisabledByVisibility(form);

  if (form.checkValidity() == false) {
    table.replaceChild(newBody, table.tBodies[0]);
    return;
  }

  const regs = generateRegValues();

  formEnableAll(form);

  // Update table
  for (let addr = 0; addr < 0x100; addr++) {
    if (addr in POR_REGS || addr in regs || addr in prevRegs) {
      const newRow = newBody.insertRow(-1);
      let newCell = null;

      // Address
      newCell = newRow.insertCell(-1);
      newCell.innerText = bToHexStr(addr);

      // Current Value
      newCell = newRow.insertCell(-1);
      if (addr in regs) {
        newCell.innerText = bToHexStr(regs[addr]);
      }

      // Prev Value
      newCell = newRow.insertCell(-1);
      if (addr in prevRegs) {
        newCell.innerText = bToHexStr(prevRegs[addr]);
      }

      // POR Value
      newCell = newRow.insertCell(-1);
      if (addr in POR_REGS) {
        newCell.innerText = bToHexStr(POR_REGS[addr]);
      }

      // Highlight changes
      if (prevRegs[addr] != regs[addr]) {
        newRow.classList.add("highlight");
      }
    }
  }
  table.replaceChild(newBody, table.tBodies[0]);

  prevRegs = regs;
}

function exportRegValues() {
  const form = document.getElementById("frmSettings");

  formUpdateDisabledByVisibility(form);

  if (form.checkValidity() == false) {
    for (const el of formElements) {
      if (! el.disabled && ! el.validity.valid) {
        el.value = el.value; // Force the .invalid-style to be applied to the
                             // field if it still has the default value.
                             // (eg. If the field was empty at start and
                             // didn't change it will not have a red border)
        el.scrollIntoView(); // Required for _output_ elements
        el.focus();
        break;
      }
    }
    return;
  }

  const regs = generateRegValues();

  // Filter out RF frequency registers only if they all have default values.
  // SX1231 latches the RF frequency registers after the LSB has been written.

  if (regs[0x07] == POR_REGS[0x07] &&
      regs[0x08] == POR_REGS[0x08] &&
      regs[0x09] == POR_REGS[0x09]) {
    delete regs[0x07];
    delete regs[0x08];
    delete regs[0x09];
  }

  // Filter out registers with the default value, except the RF frequency registers
  for (const addr in regs) {
    if(addr != 0x07 && addr != 0x08 && addr != 0x09 ) {
      if (regs[addr] == POR_REGS[addr]) {
        delete regs[addr];
      }
    }
  }

  // Dump register values to text area
  let regDump = "";
  for (const addr in regs) {
    regDump += bToHexStr(addr) + " " + bToHexStr(regs[addr]) + "\n";
  }
  document.getElementById("txtRegVal").value = regDump;

  formEnableAll(form);
}

function init() {
  let elemInpRadioCarrierFreq = document.getElementById("inpRadioCarrierFreq");

  document.getElementById("inpFXO").addEventListener("change", updateFStep);
  updateFStep();

  // Toggle modulation specific settings
  formElements["modulation"].addEventListener("change", toggleModulationSettings);
  toggleModulationSettings();

  // Check Carrier Frequency
  formElements["carrier_freq"].addEventListener("change", checkCarrierFreq);
  checkCarrierFreq();

  // Update Carrier Frequency Limits
  formElements["fstep"].addEventListener("change", updateCarrierFreqMax);
  updateCarrierFreqMax();

  /*
  document.getElementById("inpRadioFreqDev").addEventListener("change", checkFreqDev);
  document.getElementById("inpPayloadBitRate").addEventListener("change", checkFreqDev);
  checkFreqDev();
  */

  // Update Modulation Index
  formElements["fdev"].addEventListener("change", updateModulationIndex);
  formElements["bit_rate"].addEventListener("change", updateModulationIndex);
  updateModulationIndex();

  // Update Max. PA power
  formElements["tx_pin_select"].addEventListener("change", updatePaPowerMax);
  updatePaPowerMax();

  // Toggle Modulation Shapping settings groups
  formElements["modulation"].addEventListener("change", updateModulationShapingOptions);
  updateModulationShapingOptions();

  // Toggle OCP settings
  formElements["ocp_on"].addEventListener("change", toggleOcpSettings);
  toggleOcpSettings();

  // Toggle Low Beta settings
  formElements["modulation_index"].addEventListener("change", toggleLowBetaSettings);
  toggleLowBetaSettings();

  // Toggle AFC Low Beta settings
  formElements["afc_low_beta_on"].addEventListener("change", toggleAfcLowBetaSettings);
  toggleAfcLowBetaSettings();

  // Update Range on Receiver SSB Bandwidth and recalculate lookup table
  formElements["fxo"].addEventListener("change", updateRxBwOptions);
  updateRxBwOptions();

  // Enable/Disable available Receive bandwidth options
  formElements["modulation"].addEventListener("change", toggleRxBwOptions);
  // Check bandwidth option is valid
  formElements["rx_bw"].addEventListener("change", checkBw);
  formElements["afc_bw"].addEventListener("change", checkBw);

  // Toggle OOK Peak Threshold settings
  formElements["ook_thresh_type"].addEventListener("change", toggleOokThresholdSettings);
  toggleOokThresholdSettings();

  // Update Bit Rate max. value based on modulation
  formElements["modulation"].addEventListener("change", updateMaxBitRate);
  updateMaxBitRate();

  // Update Actual Bit Rate
  formElements["fxo"].addEventListener("change", updateActualBitRate);
  formElements["wanted_bit_rate"].addEventListener("change", updateActualBitRate);
  updateActualBitRate();

  // Update Spectrum SVG
  formElements["modulation"].addEventListener("change", updateSvgFskSpectrum);
  formElements["carrier_freq"].addEventListener("change", updateSvgFskSpectrum);
  formElements["fdev"].addEventListener("change", updateSvgFskSpectrum);
  formElements["bit_rate"].addEventListener("change", updateSvgFskSpectrum);
  formElements["rx_bw"].addEventListener("change", updateSvgFskSpectrum);
  formElements["afc_bw"].addEventListener("change", updateSvgFskSpectrum);
  window.addEventListener("resize", updateSvgFskSpectrum);
  updateSvgFskSpectrum();

  // Toggle Data Mode depenend options
  formElements['data_mode'].addEventListener("change", toggleDataModeSettings);
  toggleDataModeSettings();

  // Toggle packet format based settings
  formElements['packet_format'].addEventListener("change", togglePacketFormatSettings);
  togglePacketFormatSettings();
  formElements['packet_format'].addEventListener("change", toggleUnlimitedLengthConstraintSettings);
  formElements['sync_on'].addEventListener("change", toggleUnlimitedLengthConstraintSettings);
  toggleUnlimitedLengthConstraintSettings();

  // Update Sync Word Value limits
  formElements["sync_size"].addEventListener("change", updateSyncValueLimits);
  updateSyncValueLimits();

  // Toggle Sync Word settings
  formElements['sync_on'].addEventListener("change", toggleSyncWordSettings);
  toggleSyncWordSettings();

  // Validate Sync Value
  formElements["sync_value"].addEventListener("change", checkSyncValue);
  checkSyncValue();

  // Update Payload Message Length limits
  formElements["packet_format"].addEventListener("change", updatePayloadMsgLenLimits);
  formElements["aes_on"].addEventListener("change", updatePayloadMsgLenLimits);
  formElements["address_filtering"].addEventListener("change", updatePayloadMsgLenLimits);
  updatePayloadMsgLenLimits();

  // Toggle CRC settings
  formElements['crc_on'].addEventListener("change", togglePktCrcSettings);
  togglePktCrcSettings();

  // Toggle Address Filtering settings
  formElements['address_filtering'].addEventListener("change", togglePktAddrFiltSettings);
  togglePktAddrFiltSettings();

  // Toggle AES settings
  formElements['aes_on'].addEventListener("change", togglePktAesSettings);
  togglePktAesSettings();

  // Update Packet View
  formElements['preamble_size'].addEventListener("change", updatePktView);
  formElements['sync_on'].addEventListener("change", updatePktView);
  formElements['sync_value'].addEventListener("change", updatePktView);
  formElements['encoding'].addEventListener("change", updatePktView);
  formElements['packet_format'].addEventListener("change", updatePktView);
  formElements['address_filtering'].addEventListener("change", updatePktView);
  formElements['node_address'].addEventListener("change", updatePktView);
  formElements['broadcast_address'].addEventListener("change", updatePktView);
  formElements['payload_msg_len'].addEventListener("change", updatePktView);
  formElements['aes_on'].addEventListener("change", updatePktView);
  formElements['crc_on'].addEventListener("change", updatePktView);
  updatePktView();

  // Update InterPacketRxDelay Options
  formElements['bit_rate'].addEventListener("change", updateInterPacketRxDelayOptions);
  updateInterPacketRxDelayOptions();

  // toggle Auto Modes Settings
  formElements['auto_modes_on'].addEventListener("change", toggleAutoModesSettings);
  toggleAutoModesSettings();

  // Update ClkOut Options
  formElements['fxo'].addEventListener("change", updateClkOutOptions);
  updateClkOutOptions();

  // Selectable DIO Table rows
  for (const table of document.getElementsByClassName('DioTable')) {
    for (const row of table.tBodies[0].rows) {
      row.addEventListener("click", dioTableRowClick);
    }
    for (const input of table.getElementsByTagName('INPUT')) {
      input.addEventListener("change", dioSelectionChange);
    }
    updateDioTableSelection(table);
  }

  // Register im-/export
  document.getElementById("btnRegImport").addEventListener("click", importRegValues);
  document.getElementById("btnRegExport").addEventListener("click", exportRegValues);
  document.getElementById("txtRegVal").value = "";

  // TODO: REMOVE DEBUG
  const form = document.getElementById("frmSettings");
  form.addEventListener("change", updateRegisterDebugView);
  updateRegisterDebugView();
}

init();
