import { createSignal } from "solid-js";
import { Doc, Map as YMap } from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { IndexeddbPersistence } from "y-indexeddb";

import DrawArea from "./draw";
import { getRandomRPColorName } from "./color";
import OnlineAside, { createAwarenessUsers } from "./awareness";
import { createSyncArray } from "./sync";

type Position = { top: number; left: number };

type DraggingBoxPosition = {
  type: "move" | "resize";
  index: number;
  position: Position;
};

function createAppState() {
  //doc used for store data
  const doc = new Doc();
  //used for p2p
  const networkProvider = new WebrtcProvider("syn-global-room", doc);
  //attatch doc with localdb
  new IndexeddbPersistence("syn-index-db", doc);
  //
  const { localUser, remoteUsers, handleLogin, handleCursorPositionChange } =
    createAwarenessUsers(networkProvider);
  //
  const boxes = doc.getArray<YMap<any>>("boxes");
  const [draggingBoxPosition, setDraggingBoxPosition] = createSignal<null | DraggingBoxPosition>(null);
  return {
    localUser,
    remoteUsers,
    handleLogin,
    //create reactive array
    boxes: createSyncArray(boxes),
    //check if the bos is dragging
    isDragging: () => Boolean(draggingBoxPosition()),
    //do sth when a box position change
    boxCursorDown: (newDraggingPostion: DraggingBoxPosition) => {
      if (localUser()) {
        setDraggingBoxPosition(newDraggingPostion);
      }
    },
    //do sth when box was deleted.
    boxDelete(index: number) {
      if (localUser()) {
        setDraggingBoxPosition(null);
        boxes.delete(index);
      }
    },
    //do sth when cursor is moving
    moveCursor(newPosition: Position) {
      handleCursorPositionChange(newPosition);
      if (!localUser()) {
        return;
      }
      const draggingPos = draggingBoxPosition();
      if (!draggingPos) {
        return;
      }
      const { index, position, type } = draggingPos;
      const box = boxes.get(index);
      if (type === "move") {
        const boxPosition = box.get("position");
        box.set("position", {
          top: boxPosition.top + newPosition.top - position.top,
          left: boxPosition.left + newPosition.left - position.left,
        });
      } else {
        const boxSize = box.get("size");
        box.set("size", {
          height: Math.max(50, boxSize.height + newPosition.top - position.top),
          width: Math.max(50, boxSize.width + newPosition.left - position.left),
        });
      }
      setDraggingBoxPosition({ type, index, position: newPosition });
    },
    //when cusor is released.
    releaseCursor(position: Position) {
      if (!localUser()) {
        return;
      } else if (draggingBoxPosition()) {
        return setDraggingBoxPosition(null);
      }
      boxes.push([
        new YMap([
          ["position" as const, position],
          ["size" as const, { width: 100, height: 100 }],
          ["color" as const, getRandomRPColorName()],
        ]),
      ]);
    },
  };
}

function App() {
  const state = createAppState();
  return (
    <div class="flex items-stretch h-screen">
      <DrawArea
        onMoveCursor={state.moveCursor}
        onDrawPointerUp={state.releaseCursor}
        onBoxPointerDown={state.boxCursorDown}
        onBoxDelete={state.boxDelete}
        boxes={state.boxes()}
        remoteUsers={state.remoteUsers()}
        dragState={
          state.isDragging() ? "dragging" : state.localUser() ? "ready" : "none"
        }
      />
      <OnlineAside
        onLogin={state.handleLogin}
        remoteUsers={state.remoteUsers()}
        localUser={state.localUser()}
      />
    </div>
  );
}

export default App;
