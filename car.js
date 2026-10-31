const CAR_WIDTH = 50;
const CAR_LENGTH = 80;
// Each car picks its own reach beyond the front from this range.
const RAY_REACH_MIN = 120;
const RAY_REACH_MAX = 180;
// Reach beyond the front at which a car starts stopping for a light, so queues form close to the stop line.
const LIGHT_REACH = 100;
// Gap kept to the obstacle ahead and the strongest brake (air friction per step).
const MIN_GAP = 15;
const MAX_BRAKE_FRICTION = 0.1;

// Risky (red) drivers are faster, look less far ahead, tailgate and sometimes brake hard for no reason.
const RISKY_CHANCE = 0.15;
const RISKY_SPEED_FACTOR = 1.3;
const RISKY_REACH_FACTOR = 0.5;
const SUDDEN_BRAKE_CHANCE = 1 / 1500; // per step
// Share of risky drivers who don't check crossing traffic when the lights are off.
const RISKY_BLIND_CHANCE = 0.3;

const { Vector, Query, World, Composite } = Phaser.Physics.Matter.Matter;

class Car extends Phaser.Physics.Matter.Sprite {
  constructor(scene, x, y, angle, speed, name) {
    super(scene.matter.world, x, y, "car");
    this.label = "car";
    this.body.name = name;
    this.name = name;

    this.risky = Math.random() < RISKY_CHANCE;
    this.blind = this.risky && Math.random() < RISKY_BLIND_CHANCE;
    this.suddenBrakeSteps = 0;
    this.speed = this.risky ? speed * RISKY_SPEED_FACTOR : speed;
    this.initialSpeed = this.speed;
    const reach =
      Phaser.Math.FloatBetween(RAY_REACH_MIN, RAY_REACH_MAX) *
      (this.risky ? RISKY_REACH_FACTOR : 1);
    this.minGap = this.risky ? MIN_GAP / 3 : MIN_GAP;
    // Rays start at the center, so add half the car length to keep the reach past the front.
    this.rayLength = reach + CAR_LENGTH / 2;
    this.lightRayLength = LIGHT_REACH + CAR_LENGTH / 2;
    this.rayColor = 0xffffff;
    this.setDisplaySize(CAR_LENGTH, CAR_WIDTH);
    if (this.risky) {
      this.setTint(0xff0000);
    }

    this.setAngle(angle);
    this.setMass(1);
    this.setIgnoreGravity(true);
    this.rayGraphics = this.scene.add.graphics();

    this.baseFrictionAir = this.body.frictionAir;

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
  }

  // Brakes just hard enough to stop within `gap`; coasting alone is used when that is enough.
  brakeFor(gap, speed) {
    const friction = speed / Math.max(gap, 1);
    this.setFrictionAir(
      Phaser.Math.Clamp(friction, this.baseFrictionAir, MAX_BRAKE_FRICTION)
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
    // Lights that let this car pass are skipped so they don't hide cars standing just beyond them.
    const objects = this.scene.raycaster.mappedObjects.filter(
      (object) =>
        object !== this &&
        !(object.label === "trafficLight" && !object.stopsCar(this))
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

    this.text.setPosition(this.body.position.x, this.body.position.y);
    const velocity = this.getVelocity();
    const velocityMagnitude = Math.sqrt(
      velocity.x * velocity.x + velocity.y * velocity.y
    );
    this.setFrictionAir(this.baseFrictionAir);
    if (
      this.risky &&
      !this.crashed &&
      this.suddenBrakeSteps === 0 &&
      velocityMagnitude > 0.3 &&
      Math.random() < SUDDEN_BRAKE_CHANCE
    ) {
      this.suddenBrakeSteps = Phaser.Math.Between(30, 80);
    }

    if (this.crashed) {
      this.setTint(0x555888);
      this.text.setTint(0xff00000);
      this.text.setText(this.name + "\ncrash");
      this.speed = 0;
    } else if (this.suddenBrakeSteps > 0) {
      this.suddenBrakeSteps--;
      this.setFrictionAir(MAX_BRAKE_FRICTION);
    } else if (this.intersection && this.intersection.object) {
      let distance = Phaser.Math.Distance.BetweenPoints(
        new Phaser.Math.Vector2(originX, originY),
        this.intersection
      );

      const isLight = this.intersection.object.label === "trafficLight";
      if (!isLight && distance < this.rayLength) {
        this.brakeFor(distance - CAR_LENGTH / 2 - this.minGap, velocityMagnitude);
      }

      if (isLight) {
        // Lights that let this car pass are not in the cast, so a hit light always means stop.
        if (distance < this.lightRayLength) {
          this.speed = 0;
          this.brakeFor(distance - CAR_LENGTH / 2, velocityMagnitude);
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
    this.rayGraphics.destroy();
    this.text.destroy();
    // Call the parent destroy method
    super.destroy();
  }
}
