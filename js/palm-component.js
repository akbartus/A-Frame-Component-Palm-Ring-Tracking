// Create a new script element
let cameraUtilsScript = document.createElement("script");
let drawingUtilsScript = document.createElement("script");
let handsScript = document.createElement("script");
// Set the src attribute to the URL of the external JavaScript file
cameraUtilsScript.src =
  "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";
drawingUtilsScript.src =
  "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js";
handsScript.src = "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
// Add the script elements to the page
document.head.appendChild(cameraUtilsScript);
document.head.appendChild(drawingUtilsScript);
document.head.appendChild(handsScript);

AFRAME.registerComponent("palm-tracking", {
  schema: {
    landmarkIndex: { type: "number", default: 14 },
  },
  init: function () {
    let el = this.el;
      let container = document.createElement("div");
      let lindex = this.data.landmarkIndex;
    container.className = "container";
    let videoElement = document.createElement("video");
    videoElement.style.display = "none";
    videoElement.className = "input_video";
    videoElement.setAttribute("autoplay", true);
    videoElement.setAttribute("playsinline", true);
    videoElement.setAttribute("muted", true);
    let canvasElement = document.createElement("canvas");
    let canvasCtx = canvasElement.getContext("2d");
    canvasElement.className = "output_canvas";
    canvasElement.width = 700;
    canvasElement.height = 700;

    container.appendChild(videoElement);
    container.appendChild(canvasElement);
    el.appendChild(container);

    let hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      },
    });
    hands.setOptions({
      selfieMode: false,
      maxNumHands: 1,
      minDetectionConfidence: 0.5,
      modelComplexity: 0.1,
      minTrackingConfidence: 0.8,
    });
    hands.onResults(onResults);
    let camera = new Camera(videoElement, {
      onFrame: async () => {
        await hands.send({ image: videoElement });
      },
    });
    camera.start();

    let handContainers = [];
    let resetCoords = { x: 0, y: -100, z: 0 };

    // Assign values to handContainers array
    for (let i = 0; i < 2; i++) {
      handContainers[i] = [];
      for (let j = 0; j < 21; j++) {
        handContainers[i][j] = createBox(i); // create 21 boxes for each hand
      }
    }

    function createBox(handIndex) {
      let box = document.createElement("a-box");
      box.setAttribute("scale", "0.01 0.01 0.01"); // change here to disable boxes
      el.appendChild(box);
      return box;
    }

    // Set new coordinates
    function setupHand(handIndex, coordinates) {
      let marks = handContainers[handIndex];
      if (coordinates) setCoordinates(marks, coordinates);
      else resetHand(marks);
    }

    function setCoordinates(marks, coordinates) {
      for (let i = 0; i < 21; i++) {
        assignCoordinates(marks[i], coordinates[i]);
      }
    }

    // Assign new coordinates
    function assignCoordinates(box, coordinates) {
      if (!coordinates) coordinates = resetCoords;
      let x = coordinates.x - 0.5;
      let y = -coordinates.y + 0.5;
      let z = coordinates.z - 0.5;
      box.setAttribute("position", { x, y, z });
    }

    // Reset coordinates
    function resetHand(marks) {
      for (let i = 0; i < 21; i++) {
        assignCoordinates(marks[i], resetCoords);
      }
    }

    // Compute the hand rotation based on the palm normal
    function computeHandRotation(boxs) {
      let wrist = boxs[0].getAttribute("position");
      let index = boxs[8].getAttribute("position");
      let pinky = boxs[20].getAttribute("position");

      let iwVector = new THREE.Vector3().subVectors(index, wrist);
      let pwVector = new THREE.Vector3().subVectors(pinky, wrist);

      let normal = new THREE.Vector3()
        .crossVectors(iwVector, pwVector)
        .normalize();
      let xAxis = new THREE.Vector3().subVectors(pinky, index).normalize();
      let yAxis = new THREE.Vector3().crossVectors(normal, xAxis).normalize();

      let matrix = new THREE.Matrix4();
      matrix.set(
        xAxis.x,
        xAxis.y,
        xAxis.z,
        0,
        yAxis.x,
        yAxis.y,
        yAxis.z,
        0,
        normal.x,
        normal.y,
        normal.z,
        0,
        0,
        0,
        0,
        1
      );

      let euler = new THREE.Euler().setFromRotationMatrix(matrix);
      let rotationDegrees = new THREE.Vector3(
        THREE.MathUtils.radToDeg(euler.x),
        THREE.MathUtils.radToDeg(euler.y),
        THREE.MathUtils.radToDeg(euler.z)
      );

      return rotationDegrees;
    }

    function onResults(results) {
      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      canvasCtx.drawImage(
        results.image,
        0,
        0,
        canvasElement.width,
        canvasElement.height
      );

      if (results.multiHandLandmarks[0]) {
        if (results.multiHandedness[0].label == "Left") {
          // Compute the hand rotation and apply it to the entity with ID "myModel"
          let rotation = computeHandRotation(handContainers[0]);
          document
            .querySelector("#myModel")
            .setAttribute(
              "rotation",
              `${rotation.x.toFixed(2)} ${rotation.y.toFixed(
                2
              )} ${rotation.z.toFixed(2)}`
            ); // Update the positions of the hand boxes based on the landmark data

          // Check if it is GLTF file or Image
          if (!document.querySelector("#myModel").getAttribute("gltf-model")) {
            // Depending on rotation show front and back of a ring img
            if (
              document.querySelector("#myModel").getAttribute("rotation").x <
              -80
            ) {
              document
                .querySelector("#myModel")
                .setAttribute("src", "3d/ring.png");
            } else if (
              document.querySelector("#myModel").getAttribute("rotation").x >
              -100
            ) {
              document
                .querySelector("#myModel")
                .setAttribute("src", "3d/ring_back.png");
            }
          }

          setupHand(0, results.multiHandLandmarks[0]); // update left hand
          setupHand(1, results.multiHandLandmarks[1]); // update right hand

          if (results.multiHandLandmarks[0]) {
            // Set the position of the entity with ID "myModel" to be at the same position as landmark[14] of the left hand
            // Change finger
            // 6/10/14/18
            let x =
              results.multiHandLandmarks[0][lindex].x - 0.5;
            let y =
              -results.multiHandLandmarks[0][lindex].y + 0.5;
            let z =
              results.multiHandLandmarks[0][lindex].z - 0.5;
            document
              .querySelector("#myModel")
              .setAttribute("position", `${x} ${y - 0.055} ${z}`);
            document.querySelector("#myModel").setAttribute("visible", true);
          } else {
            document.querySelector("#myModel").setAttribute("visible", false);
          }
        }
      } else {
        // Reset the positions of the hand boxes
        resetHand(handContainers[0]); // reset left hand
        resetHand(handContainers[1]); // reset right hand
        document.querySelector("#myModel").setAttribute("visible", false);
      }
      canvasCtx.restore();
    }
  },
});
