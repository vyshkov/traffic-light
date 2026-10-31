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
// A car going first must leave the junction this long before an older crossing car reaches it.
const CLEARANCE_STEPS = 120;
// Share of its top speed a car is assumed to average while crossing.
const CROSSING_SPEED_SHARE = 0.8;
// How close to the junction a crossing car must be for others to notice it.
const SIGHT_DISTANCE = 600;

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

// Distances from the center, along the road, where traffic moving in `direction` (1 or -1) enters and leaves the crossing road.
function junctionSpan(road, cross, direction) {
  const edges = [0, (direction * roadWidth(road)) / 2];
  const ranges = edges.map((t) => crossingInterval(road, cross, t));
  return {
    entry: Math.max(
      ...ranges.map(([from, to]) => (direction > 0 ? -from : to))
    ),
    exit: Math.max(...ranges.map(([from, to]) => (direction > 0 ? to : -from))),
  };
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
      road.spans = {};

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
            road,
            direction,
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

        const span = junctionSpan(road, cross, direction);
        // Progress is the distance past the center along the direction of travel.
        road.spans[direction] = {
          start: -(span.entry + STOP_MARGIN),
          end: span.exit + CAR_LENGTH / 2,
        };

        const lightDistance = span.entry + STOP_MARGIN + LIGHT_DEPTH / 2;
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

      this.spawnPoints.forEach(({ x, y, angle, road, direction, sensor }) => {
        if (sensor.numberOfOverlaps === 0) {
          i++;
          this.createCar(
            this,
            x,
            y,
            angle,
            Phaser.Math.FloatBetween(MIN_SPEED, MAX_SPEED),
            i,
            road,
            direction
          );
        }
      });
    }, 5000);

    this.createUi();
  }

  createUi() {
    document.getElementById("test").addEventListener("click", () => {
      this.trafficLights.forEach((light) => light.toggle());
    });
  }

  get signalsOff() {
    return this.trafficLights[0].disabled;
  }

  // Distance past the junction center along the car's direction of travel.
  progress(car) {
    const angle = Phaser.Math.DegToRad(car.road.angle);
    return (
      ((car.x - CENTER_X) * Math.cos(angle) +
        (car.y - CENTER_Y) * Math.sin(angle)) *
      car.direction
    );
  }

  isInsideJunction(car) {
    return ROADS.every((road) => {
      const angle = Phaser.Math.DegToRad(road.angle);
      const lateral =
        -(car.x - CENTER_X) * Math.sin(angle) +
        (car.y - CENTER_Y) * Math.cos(angle);
      return Math.abs(lateral) <= roadWidth(road) / 2 + CAR_LENGTH / 2;
    });
  }

  // Whether a crossing car in sight is moving or already past its stop line.
  seesCrossTraffic(car) {
    return this.carsGroup.some((other) => {
      if (other.road === car.road) {
        return false;
      }
      const span = other.road.spans[other.direction];
      const progress = this.progress(other);
      const velocity = other.getVelocity();
      const isMoving = Math.hypot(velocity.x, velocity.y) > 0.1;
      const isInSight =
        Math.hypot(other.x - CENTER_X, other.y - CENTER_Y) < SIGHT_DISTANCE;
      return (
        isInSight &&
        progress <= span.end &&
        (isMoving || progress >= span.start)
      );
    });
  }

  // With lights on, only a crossing car already in the junction blocks. With lights off, older crossing
  // cars also block unless this car clears the junction before they arrive, so the oldest always goes first.
  isJunctionBlockedFor(car) {
    if (this.signalsOff && car.blind) {
      return false;
    }
    const span = car.road.spans[car.direction];
    const progress = this.progress(car);
    if (this.signalsOff && progress >= span.start) {
      return false;
    }
    const clearSteps =
      (span.end - progress) / (CROSSING_SPEED_SHARE * car.initialSpeed);

    return this.carsGroup.some((other) => {
      if (other === car || other.road === car.road) {
        return false;
      }
      const otherSpan = other.road.spans[other.direction];
      const otherProgress = this.progress(other);
      if (otherProgress > otherSpan.end) {
        return false;
      }
      const occupies = this.signalsOff
        ? otherProgress >= otherSpan.start
        : this.isInsideJunction(other);
      if (occupies) {
        return true;
      }
      if (
        !this.signalsOff ||
        other.crashed ||
        Number(other.name) > Number(car.name)
      ) {
        return false;
      }
      const arrivalSteps = (otherSpan.start - otherProgress) / other.initialSpeed;
      return arrivalSteps < clearSteps + CLEARANCE_STEPS;
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

  createCar(scene, x, y, angle, speed, name, road, direction) {
    const car = new Car(scene, x, y, angle, speed, name);
    car.road = road;
    car.direction = direction;
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
