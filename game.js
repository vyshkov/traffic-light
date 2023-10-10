const ROAD_WIDTH = 160;

class Example extends Phaser.Scene {
  constructor() {
    super();
  }

  preload() {
    this.load.setBaseURL("https://labs.phaser.io");
    this.load.image("bg", "assets/skies/space2.png");
    this.load.image("car", "assets/sprites/car-yellow.png");
  }

  create() {
    const bg = this.add.image(0, 0, "bg");
    bg.setOrigin(0, 0); // Set the origin to the top-left corner
    bg.displayWidth = this.sys.game.config.width; // Stretch width to match canvas width
    bg.displayHeight = this.sys.game.config.height;
    this.drawRoad();

    this.sensorHorizLeft = new SensorRectangle(
      this,
      ROAD_WIDTH / 4,
      this.sys.game.config.height / 2 + ROAD_WIDTH / 4,
      ROAD_WIDTH,
      ROAD_WIDTH / 2
    );

    this.sensorHorizRight = new SensorRectangle(
      this,
      this.sys.game.config.width - ROAD_WIDTH / 4,
      this.sys.game.config.height / 2 - ROAD_WIDTH / 4,
      ROAD_WIDTH,
      ROAD_WIDTH / 2
    );

    this.sensorVertTop = new SensorRectangle(
      this,
      this.sys.game.config.width / 2 - ROAD_WIDTH / 4,
      ROAD_WIDTH / 4,
      ROAD_WIDTH / 2,
      ROAD_WIDTH
    );

    this.sensorVertBottom = new SensorRectangle(
      this,
      this.sys.game.config.width / 2 + ROAD_WIDTH / 4,
      this.sys.game.config.height - ROAD_WIDTH / 4,
      ROAD_WIDTH / 2,
      ROAD_WIDTH
    );

    this.trafficLightHorizLeft = new TrafficLight(
      this,
      this.sys.game.config.width / 2 - ROAD_WIDTH / 2 - ROAD_WIDTH / 8,
      this.sys.game.config.height / 2 + ROAD_WIDTH / 4,
      ROAD_WIDTH / 4,
      ROAD_WIDTH / 2
    );

    this.trafficLightHorizRight = new TrafficLight(
      this,
      this.sys.game.config.width / 2 + ROAD_WIDTH / 2 + ROAD_WIDTH / 8,
      this.sys.game.config.height / 2 - ROAD_WIDTH / 4,
      ROAD_WIDTH / 4,
      ROAD_WIDTH / 2
    );

    this.trafficLightVertTop = new TrafficLight(
      this,
      this.sys.game.config.width / 2 - ROAD_WIDTH / 4,
      this.sys.game.config.height / 2 - ROAD_WIDTH / 2 - ROAD_WIDTH / 8,
      ROAD_WIDTH / 2,
      ROAD_WIDTH / 4
    );

    //this.trafficLightVertTop.nextState();
    this.trafficLightVertTop.nextState();
    this.trafficLightVertTop.nextState();

    this.trafficLightVertBottom = new TrafficLight(
      this,
      this.sys.game.config.width / 2 + ROAD_WIDTH / 4,
      this.sys.game.config.height / 2 + ROAD_WIDTH / 2 + ROAD_WIDTH / 8,
      ROAD_WIDTH / 2,
      ROAD_WIDTH / 4
    );

    //  this.trafficLightVertBottom.nextState();
    this.trafficLightVertBottom.nextState();
    this.trafficLightVertBottom.nextState();

    // Create a group of objects
    this.carsGroup = [];
    this.raycaster = this.raycasterPlugin.createRaycaster();
    this.raycaster.mapGameObjects(this.trafficLightHorizLeft);
    this.raycaster.mapGameObjects(this.trafficLightHorizRight);
    this.raycaster.mapGameObjects(this.trafficLightVertTop);
    this.raycaster.mapGameObjects(this.trafficLightVertBottom);

    this.matter.world.on("collisionstart", (event) => {
      //console.log("collision", event);
      event.pairs.forEach((pair) => {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;
        console.log(bodyA, bodyB);
        // Check if both bodies have the 'car' label
        if (
          bodyA.gameObject.label === "car" &&
          bodyB.gameObject.label === "car"
        ) {
          // Two cars are colliding
          console.log("Cars collided");

          bodyA.gameObject.crash();
          bodyB.gameObject.crash();

          // You can perform additional actions here, such as handling the collision
        } else if (bodyA.gameObject.label === "sensor") {
          bodyA.gameObject.collisionStart();
        } else if (bodyB.gameObject.label === "sensor") {
          bodyB.gameObject.collisionStart();
        }
      });
    });

    this.matter.world.on("collisionend", (event) => {
      event.pairs.forEach((pair) => {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;
        if (bodyA.gameObject?.label === "sensor") {
          bodyA.gameObject.collisionEnd();
        } else if (bodyB.gameObject?.label === "sensor") {
          bodyB.gameObject.collisionEnd();
        }
      });
    });

    let i = 0;
    setInterval(() => {
      if (this.sensorHorizLeft.numberOfOverlaps === 0) {
        i++;
        this.createCar(
          this,
          50,
          this.sys.game.config.height / 2 + ROAD_WIDTH / 4,
          0,
          Math.random() / 3 + 0.3,
          i
        );
      }

      if (this.sensorHorizRight.numberOfOverlaps === 0) {
        i++;
        this.createCar(
          this,
          this.sys.game.config.width - 50,
          this.sys.game.config.height / 2 - ROAD_WIDTH / 4,
          -180,
          Math.random() / 3 + 0.3,
          i
        );
      }

      if (this.sensorVertTop.numberOfOverlaps === 0) {
        i++;
        this.createCar(
          this,
          this.sys.game.config.width / 2 - ROAD_WIDTH / 4,
          50,
          90,
          Math.random() / 3 + 0.3,
          i
        );
      }

      if (this.sensorVertBottom.numberOfOverlaps === 0) {
        i++;
        this.createCar(
          this,
          this.sys.game.config.width / 2 + ROAD_WIDTH / 4,
          this.sys.game.config.height - 50,
          -90,
          Math.random() / 3 + 0.3,
          i
        );
      }
    }, 5000);
  }

  drawRoad() {
    // Create a graphics object for the road
    const roadGraphics = this.add.graphics();

    // Set the position of the road in the middle of the scene
    const roadY = this.cameras.main.height / 2 - ROAD_WIDTH / 2; // Adjust this value as needed
    const roadX = this.cameras.main.width / 2 - ROAD_WIDTH / 2; // Adjust this value as needed

    // Set the width and color of the road
    const roadHorizontalLength = this.cameras.main.width; // Adjust this value as needed
    const roadVerticalLength = this.cameras.main.height; // Adjust this value as needed
    const roadColor = 0x333333; // Adjust the color as needed

    // Begin filling the road graphics
    roadGraphics.fillStyle(roadColor);

    // Draw a rectangle to represent the road
    roadGraphics.fillRect(0, roadY, roadHorizontalLength, ROAD_WIDTH);
    roadGraphics.fillRect(roadX, 0, ROAD_WIDTH, roadVerticalLength);

    // End filling the road graphics
    roadGraphics.closePath();
  }

  createCar(scene, x, y, angle, speed, name) {
    const car = new Car(scene, x, y, angle, speed, name);
    this.carsGroup.push(car);
    //map car
    this.raycaster.mapGameObjects(car, true);
  }

  update() {
    const carsToRemove = [];

    this.carsGroup.forEach((car, i) => {
      if (
        car.shouldDestroy ||
        !this.cameras.main.worldView.contains(car.x, car.y)
      ) {
        carsToRemove.push(i);
      } else {
        car.update();
      }
    });

    if (carsToRemove.length > 0) {
      carsToRemove.forEach((i) => {
        const obj = this.carsGroup[i];
        this.raycaster.removeMappedObjects(obj);
        this.carsGroup.splice(i, 1);
        obj.destroy();
      });
    }
  }
}

const config = {
  type: Phaser.WEBGL,
  width: 1280,
  height: 1024,
  parent: "phaser-example",
  physics: {
    default: "matter",
    matter: {
      gravity: {
        y: 0,
      },
      debug: true,
    },
  },
  plugins: {
    scene: [
      {
        key: "PhaserRaycaster",
        plugin: PhaserRaycaster,
        mapping: "raycasterPlugin",
      },
    ],
  },
  scene: Example,
};

const game = new Phaser.Game(config);
