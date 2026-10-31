const CAR_WIDTH = 50;
const CAR_LENGTH = 80;
// Each car picks its own reach beyond the front from this range; side rays use it as their length from the center.
const RAY_REACH_MIN = 120;
const RAY_REACH_MAX = 180;
// Reach beyond the front at which a car starts stopping for a non-green light, so queues form close to the stop line.
const LIGHT_REACH = 100;
// Side ray angles (degrees) relative to the heading.
const SIDE_RAY_ANGLES = [-30, -15, 15, 30];

const { Vector, Query, World, Composite } = Phaser.Physics.Matter.Matter;

class Car extends Phaser.Physics.Matter.Sprite {
  constructor(scene, x, y, angle, speed, name) {
    super(scene.matter.world, x, y, "car");
    this.label = "car";
    this.body.name = name;
    this.name = name;

    this.speed = speed;
    this.initialSpeed = speed;
    const reach = Phaser.Math.FloatBetween(RAY_REACH_MIN, RAY_REACH_MAX);
    // Rays start at the center, so add half the car length to keep the reach past the front.
    this.rayLength = reach + CAR_LENGTH / 2;
    this.sideRayLength = reach;
    this.lightRayLength = LIGHT_REACH + CAR_LENGTH / 2;
    this.rayColor = 0xffffff;
    this.setDisplaySize(CAR_LENGTH, CAR_WIDTH);

    this.setAngle(angle);
    this.setMass(1);
    this.setIgnoreGravity(true);
    this.rayGraphics = this.scene.add.graphics();

    this.scene.add.existing(this); // Add the car to the scene

    this.text = scene.add.text(
      this.body.position.x,
      this.body.position.y,
      this.name,
      {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#FFFFFF",
      }
    );
    this.text.setOrigin(0.5);

    // Create a ray for the car
    this.ray = this.scene.raycaster.createRay();
    // Set the ray origin to the car position
    this.ray.setOrigin(this.x, this.y);
    // Set the ray angle to the car angle
    this.ray.setAngle(this.rotation);

    this.sideRays = SIDE_RAY_ANGLES.map((deg) => ({
      ray: this.scene.raycaster.createRay(),
      angle: Phaser.Math.DegToRad(deg),
    }));
  }

  // Side rays only react to crashed cars or older crossing cars, so two crossing cars can't block each other forever.
  shouldYieldTo(other) {
    if (other.label !== "car") {
      return false;
    }
    // Cars in neighboring lanes run parallel to this one and are not a threat.
    const isCrossing = Math.abs(Math.sin(other.rotation - this.rotation)) > 0.5;
    return (
      other.crashed || (isCrossing && Number(other.name) < Number(this.name))
    );
  }

  crash() {
    this.crashed = true;

    setTimeout(() => {
      this.shouldDestroy = true;
    }, 5000);
  }

  update() {
    const originX = this.x;
    const originY = this.y;
    // The car is mapped too, so exclude it or rays starting at its center would hit itself.
    // Green lights are skipped so they don't hide cars standing just beyond them.
    const objects = this.scene.raycaster.mappedObjects.filter(
      (object) =>
        object !== this &&
        !(object.label === "trafficLight" && object.state === "green")
    );

    this.ray.setOrigin(originX, originY);
    this.ray.setAngle(this.rotation);

    // Cast the ray and get the intersection
    this.intersection = this.ray.cast({ objects });

    this.rayGraphics.clear();
    this.rayGraphics.setDepth(this.depth + 1); // Set the depth
    this.rayGraphics.beginPath();
    this.rayGraphics.moveTo(originX, originY);
    this.rayGraphics.lineTo(
      originX + Math.cos(this.rotation) * this.rayLength,
      originY + Math.sin(this.rotation) * this.rayLength
    );
    this.rayGraphics.closePath();
    this.rayGraphics.strokePath();

    if (this.intersection) {
      this.rayGraphics.fillStyle(0xff0000, 0.5);
      this.rayGraphics.strokeCircle(
        this.intersection.x,
        this.intersection.y,
        5
      );
    }

    let sideHit = null;

    this.sideRays.forEach(({ ray, angle }) => {
      const rayAngle = this.rotation + angle;
      ray.setOrigin(originX, originY);
      ray.setAngle(rayAngle);
      const hit = ray.cast({ objects });

      this.rayGraphics.beginPath();
      this.rayGraphics.moveTo(originX, originY);
      this.rayGraphics.lineTo(
        originX + Math.cos(rayAngle) * this.sideRayLength,
        originY + Math.sin(rayAngle) * this.sideRayLength
      );
      this.rayGraphics.closePath();
      this.rayGraphics.strokePath();

      if (!hit || !hit.object || !this.shouldYieldTo(hit.object)) {
        return;
      }
      const hitDistance = Phaser.Math.Distance.Between(
        originX,
        originY,
        hit.x,
        hit.y
      );
      if (hitDistance < this.sideRayLength) {
        this.rayGraphics.strokeCircle(hit.x, hit.y, 5);
        if (!sideHit || hitDistance < sideHit.distance) {
          sideHit = { intersection: hit, distance: hitDistance };
        }
      }
    });

    // A traffic light straight ahead takes priority over side detections.
    if (sideHit) {
      const mainHit = this.intersection;
      const mainIsLight =
        mainHit && mainHit.object && mainHit.object.label === "trafficLight";
      const mainDistance = mainHit
        ? Phaser.Math.Distance.Between(originX, originY, mainHit.x, mainHit.y)
        : Infinity;
      if (!mainIsLight && sideHit.distance < mainDistance) {
        this.intersection = sideHit.intersection;
      }
    }

    this.text.setPosition(this.body.position.x, this.body.position.y);
    const velocity = this.getVelocity();
    const velocityMagnitude = Math.sqrt(
      velocity.x * velocity.x + velocity.y * velocity.y
    );
    if (this.crashed) {
      this.setTint(0x555888);
      this.text.setTint(0xff00000);
      this.text.setText(this.name + "\ncrash");
      this.speed = 0;
    } else if (this.intersection && this.intersection.object) {
      let distance = Phaser.Math.Distance.BetweenPoints(
        new Phaser.Math.Vector2(originX, originY),
        this.intersection
      );

      if (this.intersection.object.label === "trafficLight") {
        if (
          distance < this.lightRayLength &&
          this.intersection.object.state !== "green"
        ) {
          this.speed = 0;
        } else {
          this.speed = this.initialSpeed;
          if (velocityMagnitude < this.speed) {
            const forceX = (Math.cos(this.rotation) * this.speed) / 1800;
            const forceY = (Math.sin(this.rotation) * this.speed) / 1800;
            this.applyForce({ x: forceX, y: forceY });
          }
        }
      } else if (distance < this.rayLength && this.speed > 0) {
        this.speed = this.speed - 0.001;
      } else if (
        distance > this.rayLength * 1.1 &&
        this.speed < this.initialSpeed &&
        velocityMagnitude < this.initialSpeed
      ) {
        this.speed = this.speed + 0.001;
        const forceX = (Math.cos(this.rotation) * this.speed) / 1800;
        const forceY = (Math.sin(this.rotation) * this.speed) / 1800;
        this.applyForce({ x: forceX, y: forceY });
      } else if (velocityMagnitude < this.speed) {
        const forceX = (Math.cos(this.rotation) * this.speed) / 1800;
        const forceY = (Math.sin(this.rotation) * this.speed) / 1800;
        this.applyForce({ x: forceX, y: forceY });
      }
    } else if (velocityMagnitude < this.speed) {
      const forceX = (Math.cos(this.rotation) * this.speed) / 1800;
      const forceY = (Math.sin(this.rotation) * this.speed) / 1800;
      this.applyForce({ x: forceX, y: forceY });
    } else {
      this.speed = this.initialSpeed;
    }
  }

  destroy() {
    this.destroyed = true;
    this.ray.destroy();
    this.sideRays.forEach(({ ray }) => ray.destroy());
    this.rayGraphics.destroy();
    this.text.destroy();
    // Call the parent destroy method
    super.destroy();
  }
}
