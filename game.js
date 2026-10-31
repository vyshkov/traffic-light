const VIEW_WIDTH = 1280;
const VIEW_HEIGHT = 1024;
// The world is larger than the canvas; the camera zooms out to show all of it.
const WORLD_WIDTH = 1920;
const WORLD_HEIGHT = 1536;
const CENTER_X = WORLD_WIDTH / 2;
const CENTER_Y = WORLD_HEIGHT / 2;

const LANE_WIDTH = 80;
const LIGHT_DEPTH = LANE_WIDTH / 2;
const STOP_MARGIN = 10;
const SPAWN_SENSOR_LENGTH = 160;
const MIN_SPEED = 0.45;
const MAX_SPEED = 0.85;

// angle in degrees, lanes per direction, spawnDistance from the center along the road.
const MAIN_ROAD = { angle: 0, lanes: 2, spawnDistance: 880 };
const SIDE_ROAD = { angle: 60, lanes: 1, spawnDistance: 800 };
const ROADS = [MAIN_ROAD, SIDE_ROAD];

const roadWidth = (road) => road.lanes * 2 * LANE_WIDTH;

// Converts road coordinates (s along the road, t to the right of its direction) to world coordinates.
function roadPoint(road, s, t) {
  const angle = Phaser.Math.DegToRad(road.angle);
  return {
    x: CENTER_X + s * Math.cos(angle) - t * Math.sin(angle),
    y: CENTER_Y + s * Math.sin(angle) + t * Math.cos(angle),
  };
}

// Range of s along the line at offset t of `road` that lies inside the `cross` road.
function crossingInterval(road, cross, t) {
  const delta = Phaser.Math.DegToRad(cross.angle - road.angle);
  const half = roadWidth(cross) / 2;
  const a = (t * Math.cos(delta) - half) / Math.sin(delta);
  const b = (t * Math.cos(delta) + half) / Math.sin(delta);
  return [Math.min(a, b), Math.max(a, b)];
}

// Distance from the center at which traffic moving in `direction` (1 or -1) reaches the crossing road.
function stopDistance(road, cross, direction) {
  const edges = [0, (direction * roadWidth(road)) / 2];
  return Math.max(
    ...edges.map((t) => {
      const [from, to] = crossingInterval(road, cross, t);
      return direction > 0 ? -from : to;
    })
  );
}

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
    this.cameras.main
      .setZoom(VIEW_WIDTH / WORLD_WIDTH)
      .centerOn(CENTER_X, CENTER_Y);

    const bg = this.add.image(0, 0, "bg");
    bg.setOrigin(0, 0); // Set the origin to the top-left corner
    bg.displayWidth = WORLD_WIDTH;
    bg.displayHeight = WORLD_HEIGHT;
    this.drawRoad();

    this.spawnPoints = [];
    this.trafficLights = [];

    ROADS.forEach((road) => {
      const cross = ROADS.find((other) => other !== road);

      [1, -1].forEach((direction) => {
        for (let lane = 0; lane < road.lanes; lane++) {
          const position = roadPoint(
            road,
            -direction * road.spawnDistance,
            direction * (lane + 0.5) * LANE_WIDTH
          );
          this.spawnPoints.push({
            x: position.x,
            y: position.y,
            angle: road.angle + (direction > 0 ? 0 : 180),
            sensor: new SensorRectangle(
              this,
              position.x,
              position.y,
              SPAWN_SENSOR_LENGTH,
              LANE_WIDTH,
              road.angle
            ),
          });
        }

        const lightDistance =
          stopDistance(road, cross, direction) + STOP_MARGIN + LIGHT_DEPTH / 2;
        const lightPosition = roadPoint(
          road,
          -direction * lightDistance,
          (direction * roadWidth(road)) / 4
        );
        const light = new TrafficLight(
          this,
          lightPosition.x,
          lightPosition.y,
          LIGHT_DEPTH,
          roadWidth(road) / 2,
          road.angle
        );

        // The side road starts on red while the main road is green.
        if (road === SIDE_ROAD) {
          light.nextState();
          light.nextState();
        }
        this.trafficLights.push(light);
      });
    });

    // Create a group of objects
    this.carsGroup = [];
    this.raycaster = this.raycasterPlugin.createRaycaster();
    this.raycaster.mapGameObjects(this.trafficLights);

    this.matter.world.on("collisionstart", (event) => {
      event.pairs.forEach((pair) => {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;
        // Check if both bodies have the 'car' label
        if (
          bodyA.gameObject.label === "car" &&
          bodyB.gameObject.label === "car"
        ) {
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

      if (document.hidden) {
        return;
      }

      this.spawnPoints.forEach(({ x, y, angle, sensor }) => {
        if (sensor.numberOfOverlaps === 0) {
          i++;
          this.createCar(
            this,
            x,
            y,
            angle,
            Phaser.Math.FloatBetween(MIN_SPEED, MAX_SPEED),
            i
          );
        }
      });
    }, 5000);

    this.createUi();
  }

  createUi() {
    document.getElementById("test").addEventListener("click", () => {
      this.trafficLights.forEach((light) => light.toggle());

      if (this.trafficLights[0].disabled) {
        this.raycaster.removeMappedObjects(this.trafficLights);
      } else {
        this.raycaster.mapGameObjects(this.trafficLights);
      }
    });
  }

  drawRoad() {
    const roadGraphics = this.add.graphics();
    // Long enough to cover the whole world at any road angle.
    const halfLength = Math.hypot(WORLD_WIDTH, WORLD_HEIGHT) / 2;

    roadGraphics.fillStyle(0x333333);
    ROADS.forEach((road) => {
      const half = roadWidth(road) / 2;
      const corners = [
        [-halfLength, -half],
        [halfLength, -half],
        [halfLength, half],
        [-halfLength, half],
      ].map(([s, t]) => roadPoint(road, s, t));
      roadGraphics.fillPoints(corners, true);
    });

    // Markings go on top of both roads and leave a gap where the other road crosses.
    const drawLine = (road, t, color, dashed) => {
      const cross = ROADS.find((other) => other !== road);
      const [from, to] = crossingInterval(road, cross, t);
      const dash = dashed ? 30 : Infinity;
      const gap = dashed ? 30 : 0;

      roadGraphics.lineStyle(4, color);
      [
        [-halfLength, from],
        [to, halfLength],
      ].forEach(([start, end]) => {
        for (let s = start; s < end; s += dash + gap) {
          const a = roadPoint(road, s, t);
          const b = roadPoint(road, Math.min(s + dash, end), t);
          roadGraphics.lineBetween(a.x, a.y, b.x, b.y);
        }
      });
    };

    ROADS.forEach((road) => {
      const edge = roadWidth(road) / 2 - 4;
      drawLine(road, -3, 0xf5c518, false);
      drawLine(road, 3, 0xf5c518, false);
      drawLine(road, -edge, 0xffffff, false);
      drawLine(road, edge, 0xffffff, false);

      for (let lane = 1; lane < road.lanes; lane++) {
        drawLine(road, lane * LANE_WIDTH, 0xffffff, true);
        drawLine(road, -lane * LANE_WIDTH, 0xffffff, true);
      }
    });
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
      // Reverse order keeps the remaining indices valid while splicing.
      carsToRemove.reverse().forEach((i) => {
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
  width: VIEW_WIDTH,
  height: VIEW_HEIGHT,
  parent: "game",
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
