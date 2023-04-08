import React, { memo, useEffect, useState, useContext } from "react";
import { Handle } from "reactflow";
import {
  MarkerType,
  useNodes,
  useUpdateNodeInternals,
  useStoreApi,
} from "reactflow";
import ReverseContext from "../context/ReverseContext";

import "../styles/Field.css";

const Field = ({
  typeName,
  fieldName,
  returnType,
  args,
  updateEdge,
  relationship,
  active,
  displayMode,
  fieldHighlightColor,
  edgeDefaultColor,
}) => {
  const nodes = useNodes();
  const updateNodeInternals = useUpdateNodeInternals();
  const [handlePosition, setHandlePosition] = useState("right");
  const store = useStoreApi();

  const { setRevClickedField, revActiveTypesNFields, reverseMode } =
    useContext(ReverseContext);

  const fieldActive = {
    backgroundColor: fieldHighlightColor + "ca",
  };

  useEffect(() => {
    // In vSchema:
    // 'Relationship' is a key on a field object that only exists if that field points to a type.
    // Its value corresponds 1:1 to the object type name and its node's id
    if (
      relationship &&
      !store
        .getState()
        .edges.some(
          (edge) => edge.id === `${typeName}/${fieldName}-${relationship}`
        )
    ) {
      const targetType = relationship;
      updateEdge({
        id: `${typeName}/${fieldName}-${targetType}`,
        source: typeName,
        sourceHandle: `${typeName}/${fieldName}`,
        target: targetType,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeDefaultColor,
          width: 28,
          height: 28,
          strokeWidth: 0.7,
        },
        style: {
          stroke: edgeDefaultColor,
          strokeWidth: "1.1",
        },
        hidden: false,
        active: false,
        isGhost: false,
      });
    }
  }, []);

  /* Dynamically shift around the handles */
  // I originally tried to store curr and target nodes in state
  // and assign them only once in useEffect, however ... that created
  // all sorts of unintended behavior
  // You'd think it'd be easier that way ... it seems 'references' got lost in state
  // So here, we're 'brute forcing' instead.
  if (relationship) {
    const targetNode = nodes.find((node) => node.id === relationship);
    const currNode = nodes.find((node) => node.id === typeName);
    const targetPosition = targetNode.position;
    const currPosition = currNode.position;
    if (currPosition.x > targetPosition.x && handlePosition !== "left") {
      setHandlePosition("left");
      updateNodeInternals(typeName);
    } else if (
      currPosition.x < targetPosition.x &&
      handlePosition !== "right"
    ) {
      setHandlePosition("right");
      updateNodeInternals(typeName);
    }
  }

  const reverseClickHandler = () => {
    if (!reverseMode) return;
    if (revActiveTypesNFields === null || revActiveTypesNFields[typeName]) {
      setRevClickedField({ typeName, fieldName, relationship, args });
    } else {
      console.log(`DOES NOT PASS`);
      // setRevClickedField({ typeName, fieldName, relationship });
    }
  };

  return (
    <div
      className={`field ${active ? "active" : ""} ${
        reverseMode ? "reverse-mode" : ""
      }`}
      style={active ? fieldActive : {}}
      onClick={reverseClickHandler}
    >
      <div className="field-data">
        <p className="field-name">{fieldName}</p>
        <p className="return-type">{returnType}</p>
      </div>
      {relationship && (
        <Handle
          type="source"
          position={handlePosition}
          isConnectable={false}
          id={`${typeName}/${fieldName}`}
        />
      )}
    </div>
  );
};

export default memo(Field);
