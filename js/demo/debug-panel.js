(function () {
  "use strict";

  var ns = window.CinematicMotion = window.CinematicMotion || {};

  function formatRuntimeRow(item) {
    var duration = item.duration == null ? "-" : item.duration.toFixed(2) + "s";
    var position = item.position == null ? "-" : item.position.toFixed(2) + "s";
    return (
      item.id.padEnd(12, " ") +
      " preset=" +
      String(item.preset).padEnd(14, " ") +
      " ease=" +
      String(item.easeToken || "-").padEnd(20, " ") +
      " dur=" +
      duration.padEnd(7, " ") +
      " at=" +
      position
    );
  }

  ns.initDebugPanel = function initDebugPanel(engine, textCompartment) {
    if (!engine) {
      throw new Error("initDebugPanel requires a valid motion engine.");
    }

    var targetSelect = document.getElementById("targetSelect");
    var presetSelect = document.getElementById("presetSelect");
    var replayBtn = document.getElementById("replayBtn");
    var speedRange = document.getElementById("speedRange");
    var speedValue = document.getElementById("speedValue");
    var guidesToggle = document.getElementById("guidesToggle");
    var statusLine = document.getElementById("statusLine");
    var runtimeReadout = document.getElementById("runtimeReadout");
    var wordCountFilterSelect = document.getElementById("wordCountFilterSelect");
    var wordBankSelect = document.getElementById("wordBankSelect");
    var customWordInput = document.getElementById("customWordInput");
    var applyWordBtn = document.getElementById("applyWordBtn");
    var replayWordBtn = document.getElementById("replayWordBtn");
    var autoRotateToggle = document.getElementById("autoRotateToggle");
    var cycleRange = document.getElementById("cycleRange");
    var cycleValue = document.getElementById("cycleValue");
    var textMappingReadout = document.getElementById("textMappingReadout");
    var applyWordDebounceId = null;

    function setStatus(text) {
      statusLine.textContent = text;
    }

    function clearElement(element) {
      while (element.firstChild) {
        element.removeChild(element.firstChild);
      }
    }

    function buildPresetOptions() {
      var presetNames = engine.getPresets();
      clearElement(presetSelect);
      presetNames.forEach(function (name) {
        var option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        presetSelect.appendChild(option);
      });
    }

    function updateReadout() {
      var lines = engine.getRuntimeReport().map(formatRuntimeRow);
      if (textCompartment) {
        lines.push("");
        lines = lines.concat(textCompartment.getRuntimeRows());
      }
      runtimeReadout.textContent = lines.join("\n");
    }

    function updateTextMappingReadout() {
      if (!textCompartment || !textMappingReadout) {
        return;
      }
      textMappingReadout.textContent = textCompartment.getMappingSummary();
    }

    function syncPresetSelector() {
      var target = targetSelect.value;
      var presetName = null;

      if (target === "all") {
        presetName = engine.getGlobalPreset() || engine.getRuntimeReport()[0].preset;
      } else {
        var objectState = engine.getObjectState(target);
        presetName = objectState ? objectState.effectivePreset : null;
      }

      if (presetName && engine.hasPreset(presetName)) {
        presetSelect.value = presetName;
      }
    }

    function applyPreset() {
      var target = targetSelect.value;
      var selectedPreset = presetSelect.value;

      if (target === "all") {
        engine.setPresetForAll(selectedPreset);
        setStatus("Preset '" + selectedPreset + "' applied to all objects.");
      } else {
        var didApply = engine.setPresetForObject(target, selectedPreset);
        setStatus(
          didApply
            ? "Preset '" + selectedPreset + "' applied to " + target + "."
            : "Object '" + target + "' was not found."
        );
      }

      engine.replay();
      if (textCompartment) {
        textCompartment.replayCurrent();
      }
      updateReadout();
    }

    function refreshWordBankOptions() {
      if (!textCompartment || !wordBankSelect) {
        return;
      }

      var words = textCompartment.getVisibleWordBank();
      var activeWord = textCompartment.getCurrentWord();

      clearElement(wordBankSelect);
      if (words.length === 0) {
        var emptyOption = document.createElement("option");
        emptyOption.value = "";
        emptyOption.textContent = "No words match this filter";
        wordBankSelect.appendChild(emptyOption);
        wordBankSelect.disabled = true;
        return;
      }

      wordBankSelect.disabled = false;
      words.forEach(function (word) {
        var option = document.createElement("option");
        option.value = word;
        option.textContent = word;
        wordBankSelect.appendChild(option);
      });

      if (activeWord && words.some(function (word) {
        return word.toLowerCase() === activeWord.toLowerCase();
      })) {
        wordBankSelect.value = words.find(function (word) {
          return word.toLowerCase() === activeWord.toLowerCase();
        });
      }
    }

    function applyWordFromControls() {
      if (!textCompartment) {
        return;
      }

      var customValue = customWordInput ? customWordInput.value : "";
      var selectedWord = wordBankSelect ? wordBankSelect.value : "";
      var candidate = String(customValue || "").trim() || selectedWord;
      if (!candidate) {
        candidate = textCompartment.getCurrentWord();
      }

      var didApply = textCompartment.applyWord(candidate, { reason: "manual" });
      if (didApply) {
        if (customWordInput) {
          customWordInput.value = "";
        }
        refreshWordBankOptions();
        updateTextMappingReadout();
        updateReadout();
        setStatus("Word '" + textCompartment.getCurrentWord() + "' applied.");
      } else {
        setStatus("No valid word to apply.");
      }
    }

    function scheduleApplyWordFromControls() {
      if (applyWordDebounceId) {
        clearTimeout(applyWordDebounceId);
      }
      applyWordDebounceId = setTimeout(function () {
        applyWordFromControls();
      }, 120);
    }

    targetSelect.addEventListener("change", function () {
      syncPresetSelector();
      setStatus("Target changed to '" + targetSelect.value + "'.");
    });

    presetSelect.addEventListener("change", applyPreset);

    replayBtn.addEventListener("click", function () {
      engine.replay();
      if (textCompartment) {
        textCompartment.replayCurrent();
      }
      updateReadout();
      setStatus("Timeline replayed.");
    });

    speedRange.addEventListener("input", function () {
      var value = Number(speedRange.value) || 1;
      engine.setSpeed(value);
      speedValue.textContent = value.toFixed(2) + "x";
      setStatus("Speed set to " + value.toFixed(2) + "x.");
    });

    guidesToggle.addEventListener("change", function () {
      var enabled = guidesToggle.checked;
      engine.setShowGuides(enabled);
      setStatus(enabled ? "Off-frame guides enabled." : "Off-frame guides hidden.");
    });

      if (textCompartment) {
        if (wordCountFilterSelect) {
          wordCountFilterSelect.addEventListener("change", function () {
            var filterValue = wordCountFilterSelect.value || "all";
            textCompartment.setWordCountFilter(filterValue);
            refreshWordBankOptions();
            updateTextMappingReadout();
            updateReadout();
            setStatus("Word filter set to '" + filterValue + "'.");
          });
        }

      if (applyWordBtn) {
        applyWordBtn.addEventListener("click", scheduleApplyWordFromControls);
      }

      if (replayWordBtn) {
        replayWordBtn.addEventListener("click", function () {
          textCompartment.replayCurrent();
          updateReadout();
          setStatus("Active word replayed.");
        });
      }

      if (wordBankSelect) {
        wordBankSelect.addEventListener("change", function () {
          if (wordBankSelect.value) {
            textCompartment.applyWord(wordBankSelect.value, { reason: "bank-select" });
            updateTextMappingReadout();
            updateReadout();
            setStatus("Word bank switched to '" + wordBankSelect.value + "'.");
          }
        });
      }

      if (customWordInput) {
        customWordInput.addEventListener("keydown", function (event) {
          if (event.key === "Enter") {
            event.preventDefault();
            scheduleApplyWordFromControls();
          }
        });
      }

      if (autoRotateToggle) {
        autoRotateToggle.addEventListener("change", function () {
          textCompartment.setAutoRotate(autoRotateToggle.checked);
          updateTextMappingReadout();
          setStatus(autoRotateToggle.checked ? "Auto rotate enabled." : "Auto rotate disabled.");
        });
      }

      if (cycleRange && cycleValue) {
        cycleRange.addEventListener("input", function () {
          var nextMs = Number(cycleRange.value) || 3200;
          textCompartment.setIntervalMs(nextMs);
          cycleValue.textContent = nextMs + "ms";
          setStatus("Word cycle interval set to " + nextMs + "ms.");
        });
      }

      textCompartment.onChange(function () {
        refreshWordBankOptions();
        updateTextMappingReadout();
        updateReadout();
      });
    }

    buildPresetOptions();
    engine.setSpeed(Number(speedRange.value) || 1);
    speedValue.textContent = (Number(speedRange.value) || 1).toFixed(2) + "x";
    syncPresetSelector();

    if (textCompartment) {
      if (wordCountFilterSelect) {
        wordCountFilterSelect.value = textCompartment.getWordCountFilter();
      }
      refreshWordBankOptions();
      if (autoRotateToggle) {
        autoRotateToggle.checked = textCompartment.isAutoRotate();
      }
      if (cycleRange && cycleValue) {
        cycleRange.value = String(textCompartment.getIntervalMs());
        cycleValue.textContent = textCompartment.getIntervalMs() + "ms";
      }
      updateTextMappingReadout();
    }

    updateReadout();
    setStatus("Debug panel ready.");

    return {
      updateReadout: updateReadout,
      setStatus: setStatus,
      updateTextMappingReadout: updateTextMappingReadout,
      refreshWordBankOptions: refreshWordBankOptions
    };
  };
}());
