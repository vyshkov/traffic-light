const trafficLightColors = ["green", "yellow", "red", "yellow"];
// Long enough for the slowest car to clear the junction while both roads are stopped.
const PHASE_DURATION_MS = 20000;

class TrafficLight extends Phaser.Physics.Matter.Sprite {
  constructor(scene, x, y, width, height, angle = 0, options) {
    super(scene.matter.world, x, y, null, null, options);
    this.lastCarName = null;
    this.counter = 0;
    this.label = "trafficLight";

    this.state = "green";
    this.stateIndex = 0;
    this.numberOfOverlaps = 0;
    this.disabled = false;

    // Make the sensor invisible by default
    this.setAlpha(0);

    // Set the size of the sensor rectangle
    this.setDisplaySize(width, height);
    this.width = width;
    this.height = height;
    // Set the sensor property to true to make it a sensor
    this.setSensor(true);
    this.setAngle(angle);

    // Add the custom sensor rectangle to the scene
    scene.add.existing(this);

    // Create a Graphics object for background color
    this.background = scene.add.graphics();
    //this.background.setDepth(this.depth + 1); // Set the depth
    this.updateBackgroundColor();

    this.text = scene.add.text(this.x, this.y, "", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#FFFFFF",
    });
    this.text.setOrigin(0.5);

    setInterval(() => {
      if (!this.disabled) {
        this.nextState();
      }
    }, PHASE_DURATION_MS);
  }

  nextState() {
    this.stateIndex++;
    this.state =
      trafficLightColors[this.stateIndex % trafficLightColors.length];

    this.updateBackgroundColor();
  }

  toggle() {
    this.disabled = !this.disabled;
    if (this.disabled) {
      this.background.clear();
    } else {
      this.updateBackgroundColor();
    }
  }

  // A disabled light is a yield line: cars stop only while crossing traffic has the junction.
  stopsCar(car) {
    if (!this.disabled && this.state !== "green") {
      return !car.risky || this.scene.seesCrossTraffic(car);
    }
    return this.scene.isJunctionBlockedFor(car);
  }

  updateBackgroundColor() {
    this.background.clear();

    if (this.state === "green") {
      this.background.fillStyle(0x00ff00, 0.5);
    } else if (this.state === "yellow") {
      this.background.fillStyle(0xffff00, 0.5);
    } else {
      this.background.fillStyle(0xff0000, 0.5);
    }

    // The body vertices are in world coordinates, so this also covers rotated lights.
    this.background.fillPoints(this.body.vertices, true);
  }

  collisionStart() {
    this.numberOfOverlaps++;
    this.updateBackgroundColor();
    this.text.setText(this.counter);
  }

  collisionEnd() {
    this.counter++;
  }

  update() {}
}
