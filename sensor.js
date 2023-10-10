class SensorRectangle extends Phaser.Physics.Matter.Sprite {
  constructor(scene, x, y, width, height, options) {
    super(scene.matter.world, x, y, null, null, options);
    this.lastCarName = null;
    this.counter = 0;
    this.label = "sensor";

    this.numberOfOverlaps = 0;

    // Make the sensor invisible by default
    this.setAlpha(0);

    // Set the size of the sensor rectangle
    this.setDisplaySize(width, height);
    this.width = width;
    this.height = height;
    // Set the sensor property to true to make it a sensor
    this.setSensor(true);

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
  }

  updateBackgroundColor() {
    // Clear the previous background and redraw
    this.background.clear();

    if (this.numberOfOverlaps === 0) {
      // No overlaps, set green background
      this.background.fillStyle(0x00ff00, 0.5);
    } else {
      // Overlaps exist, set red background
      this.background.fillStyle(0xff0000, 0.5);
    }

    this.background.fillRect(
      this.x - this.width / 2,
      this.y - this.height / 2,
      this.width,
      this.height
    );
  }

  collisionStart() {
    this.numberOfOverlaps++;
    this.updateBackgroundColor();
    this.text.setText(this.counter);
  }

  collisionEnd() {
    this.numberOfOverlaps--;
    if (this.numberOfOverlaps === 0) {
      this.counter++;
    }
    this.updateBackgroundColor();
    this.text.setText(this.counter);
  }

  update() {}
}
