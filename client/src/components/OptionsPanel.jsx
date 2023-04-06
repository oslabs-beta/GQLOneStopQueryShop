import { useState, useContext, useEffect } from "react";
import { Panel } from "reactflow";
import "../styles/OptionsPanel.css";
import { ToggleSwitch } from "./ToggleSwitch";
import { ColorPicker } from "./ColorPicker";
import { motion } from "framer-motion";
import ReverseContext from "../context/ReverseContext";

export function OptionsPanel({
  visualizerOptions,
  toggleTargetPosition,
  displayMode,
  toggleDisplayMode,
  toggleMinimap,
  toggleControls,
  customColors,
  setCustomColors,
  ghostMode,
  toggleGhostMode,
}) {
  const { targetPosition, showMinimap, showControls } = visualizerOptions;
  const { reverseMode } = useContext(ReverseContext);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!reverseMode && displayMode === "activeOnly" && ghostMode === "on") {
      toggleDisplayMode();
      toggleGhostMode();
    }
  }, [reverseMode]);

  return (
    <>
      <Panel position="top-right" className="options-panel__container">
        <h4 className="options-panel__header">
          <button
            className="options-panel__expand-button"
            onClick={() => setCollapsed(!collapsed)}
          >
            Display Options{" "}
            <motion.div
              animate={{ rotate: collapsed ? 0 : 180 }}
              id="options-panel__rotating-button"
            >
              {"\u25be"}
            </motion.div>
          </button>
        </h4>
        {!collapsed && <hr className="options-panel__hr" />}
        {!collapsed && (
          <div>
            <ToggleSwitch
              toggleName="active only"
              labelLeft="Off"
              labelRight="On"
              isChecked={displayMode === "activeOnly"}
              handleChange={toggleDisplayMode}
            />
            <ToggleSwitch
              toggleName="ghost mode"
              labelLeft="off"
              labelRight="on"
              isChecked={ghostMode === "on"}
              handleChange={toggleGhostMode}
            />
            <ToggleSwitch
              toggleName="target position"
              labelLeft="left"
              labelRight="top"
              isChecked={targetPosition === "top"}
              handleChange={toggleTargetPosition}
            />
            <ToggleSwitch
              toggleName="show minimap"
              labelLeft="off"
              labelRight="on"
              isChecked={showMinimap}
              handleChange={toggleMinimap}
            />
            <ToggleSwitch
              toggleName="show controls"
              labelLeft="off"
              labelRight="on"
              isChecked={showControls}
              handleChange={toggleControls}
            />

            {/* <ColorPicker
              pickerName="Node Highlight"
              handleChange={setCustomColors}
              target='nodeHighlight'
              defaultColor={customColors}
            /> */}
            <ColorPicker
              pickerName="Field Highlight"
              handleChange={setCustomColors}
              target="fieldHighlight"
              defaultColor={customColors}
            />
            <ColorPicker
              pickerName="Edge Default"
              handleChange={setCustomColors}
              target="edgeDefault"
              defaultColor={customColors}
            />
            <ColorPicker
              pickerName="Edge Highlight"
              handleChange={setCustomColors}
              target="edgeHighlight"
              defaultColor={customColors}
            />
          </div>
        )}
      </Panel>
    </>
  );
}
