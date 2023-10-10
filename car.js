const CAR_WIDTH = 50;
const CAR_LENGTH = 80;
const RAY_LENGTH = 100;

const { Vector, Query, World, Composite } = Phaser.Physics.Matter.Matter;

class Car extends Phaser.Physics.Matter.Sprite {
  constructor(scene, x, y, angle, speed, name) {
    super(scene.matter.world, x, y, "car");
    this.label = "car";
    this.body.name = name;
    this.name = name;

    this.speed = speed;
    this.initialSpeed = speed;
    this.rayLength = RAY_LENGTH;
    this.rayColor = 0xffffff;
    this.setDisplaySize(CAR_LENGTH, CAR_WIDTH);

    this.setAngle(angle);
    this.setMass(1);
    this.setIgnoreGravity(true);
    this.rayGraphics = this.scene.add.graphics();

    // Calculate an offset for the ray to cast it in front of the car
    this.offset = new Phaser.Math.Vector2(
      Math.cos(this.rotation) * (CAR_LENGTH / 2 + 1),
      Math.sin(this.rotation) * (CAR_LENGTH / 2 + 1)
    );

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

    // Calculate an offset for the ray to cast it in front of the car
    this.offset = new Phaser.Math.Vector2();

    // Create a ray for the car
    this.ray = this.scene.raycaster.createRay();
    // Set the ray origin to the car position
    this.ray.setOrigin(this.x + this.offset.x, this.y + this.offset.y);
    // Set the ray angle to the car angle
    this.ray.setAngle(this.rotation);
  }

  crash() {
    this.crashed = true;

    setTimeout(() => {
      this.shouldDestroy = true;
    }, 5000);
  }

  update() {
    // Calculate an offset for the ray to cast it in front of the car
    this.offset = new Phaser.Math.Vector2(
      Math.cos(this.rotation) * (CAR_LENGTH / 2 + 1),
      Math.sin(this.rotation) * (CAR_LENGTH / 2 + 1)
    );
    // Update the ray origin and angle
    this.ray.setOrigin(this.x + this.offset.x, this.y + this.offset.y);
    this.ray.setAngle(this.rotation);

    // Cast the ray and get the intersection
    this.intersection = this.ray.cast();

    this.rayGraphics.clear();
    this.rayGraphics.setDepth(this.depth + 1); // Set the depth
    this.rayGraphics.beginPath();
    this.rayGraphics.moveTo(this.offset.x + this.x, this.offset.y + this.y);
    this.rayGraphics.lineTo(
      this.offset.x + this.x + Math.cos(this.rotation) * this.rayLength,
      this.offset.y + this.y + Math.sin(this.rotation) * this.rayLength
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
    if (this.crashed) {
      this.setTint(0x555888);
      this.text.setTint(0xff00000);
      this.text.setText(this.name + "\ncrash");
      this.speed = 0;
    } else if (this.intersection && this.intersection.object) {
      let distance = Phaser.Math.Distance.BetweenPoints(
        new Phaser.Math.Vector2(this.x + this.offset.x, this.y + this.offset.y),
        this.intersection
      );

      if (this.intersection.object.label === "trafficLight") {
        if (
          distance < this.rayLength &&
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
    this.rayGraphics.destroy();
    this.text.destroy();
    // Call the parent destroy method
    super.destroy();
  }
}
