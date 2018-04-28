class MotionLib {
	constructor(opts) {
		// Copy options to local properties
		this.id = opts.id;
		this.video = opts.video;
		this.mediaStream = opts.mediaStream;
		this.diffCanvas = opts.diffCanvas;
		this.motionBarCanvas = opts.motionBarCanvas;
		this.diffWidth = opts.diffWidth ? opts.diffWidth : 75;
		this.diffHeight = opts.diffHeight ? opts.diffHeight : 50;
		this.pixelDiffThreshold = opts.pixelDiffThreshold ? opts.pixelDiffThreshold : 80; // default 80
		this.scoreThreshold = opts.scoreThreshold ? opts.scoreThreshold : 15; // default 15
		this.interval = opts.interval ? opts.interval : 200;
		this.onDiff = opts.onDiff;
		this.useImageCapture = opts.useImageCapture;

		// Initialize local properties
		this.motionBarPosition = 0;

		// Create virtual diff canvas if one wasn't provided
		if (!this.diffCanvas)
			this.diffCanvas = document.createElement('canvas');

		// Validate media source. Prefer media stream direct (most efficient (TODO: is this true???))
		let canCapture = this.canImageCapture();
		if (this.mediaStream && canCapture && this.useImageCapture === true) {
			// This type must be explicitly requested. The performance currently sucks. It's about 10x worse than current performance.
			this.captureType = 'mediastreamdirect';
			this.imageCapture = new ImageCapture(this.mediaStream.getVideoTracks()[0]);
		} else if (this.mediaStream && !canCapture) {
			this.captureType = 'mediastreamindirect';
			this.video = document.createElement('video');
			this.video.srcObject = this.mediaStream;
			this.video.play();
		} else if (this.video) {
			this.captureType = 'videoelement';
		} else {
			throw new Error('Missing config property: mediaStream or video is required');
		}
		if (this.captureType === 'mediastreamindirect' || this.captureType === 'videoelement') {
			this.imageCaptureCanvas = document.createElement('canvas');
			this.imageCaptureCanvasContext = this.imageCaptureCanvas.getContext('2d');
		}
		console.log(`Capture type: ${this.captureType}`);

		this.canvasA = document.createElement('canvas');
		this.canvasB = document.createElement('canvas');
		this.lastCanvas = 'a';
	}

	diffImages(canvasA, canvasB) {
		if (!canvasA || !canvasB) return;
		if (canvasA.width === 0 || canvasA.height === 0) return;
		if (canvasB.width === 0 || canvasB.height === 0) return;

		// TODO: use settings to correctly determine size
		let ratio = canvasA.width/canvasA.height;
		this.diffHeight = this.diffWidth/ratio;
		this.diffCanvas.width = this.diffWidth;
		this.diffCanvas.height = this.diffHeight;
		this.diffCanvas.style.display = 'inline-block';

		// Draw diff image
		let context = this.diffCanvas.getContext('2d');
		context.globalCompositeOperation = 'difference';
		context.clearRect(0, 0, this.diffCanvas.width, this.diffCanvas.height);
		context.drawImage(canvasA, 0, 0, this.diffCanvas.width, this.diffCanvas.height);
		context.drawImage(canvasB, 0, 0, this.diffCanvas.width, this.diffCanvas.height);

		// Get diff image data
		let imageData = context.getImageData(0, 0, this.diffCanvas.width, this.diffCanvas.height);

		// Process diff image
		let diff = this.processDiff(imageData);
		if (this.onDiff) this.onDiff(diff);

		// clear raw diff pixels and draw new mono diff pixels
		context.clearRect(0, 0, this.diffCanvas.width, this.diffCanvas.height);
		context.putImageData(imageData, 0, 0);
	}

	processDiff(image) {
		// Make diff image green
		let rgba = image.data;
		let score = 0;
	/*	for (let i = 0; i < rgba.length; i += 4) {
			let pixelDiff = rgba[i] * 0.3 + rgba[i + 1] * 0.6 + rgba[i + 2] * 0.1;
			let normalized = Math.min(255, pixelDiff * (255 / this.pixelDiffThreshold));
			rgba[i] = 0;
			rgba[i + 1] = normalized;
			rgba[i + 2] = 0; */

			for (let i = 0; i < rgba.length; i += 4) {
				let pixelDiff = rgba[i] * 0.3 + rgba[i + 1] * 0.6 + rgba[i + 2] * 0.1;
				let normalized = Math.min(255, pixelDiff * (255 / this.pixelDiffThreshold));
				rgba[i] = normalized * 0.6; // make diff image red instead
				rgba[i + 1] = 0;
				rgba[i + 2] = 0;

			if (pixelDiff >= this.pixelDiffThreshold) {
				score++;
			}
		}

		let diffData = {
			id: this.id,
			score: score,
			isMotion: score > this.scoreThreshold
		};

		this.renderMotionBar(diffData.isMotion);

		return diffData;
	}

	captureImage() {
		this.captureImageImpl()
			.then(() => {
				// Perform diff
				if (this.lastCanvas === 'a')
					this.diffImages(this.canvasB, this.canvasA);
				else
					this.diffImages(this.canvasA, this.canvasB);

				if (this.isActive === true)
					setTimeout(this.captureImage.bind(this), this.interval);
			})
			.catch((err) => {
				console.error(err);
			});
	}

	captureImageImpl() {
		return new Promise((resolve, reject) => {
			switch (this.captureType) {
				case 'mediastreamdirect': {
					this.captureImageFromStream()
						.then(() => resolve())
						.catch((err) => reject(err));
					break;
				}
				case 'mediastreamindirect': {
					this.captureImageFromVideo();
					resolve();
					break;
				}
				case 'videoelement': {
					this.captureImageFromVideo();
					resolve();
					break;
				}
				default: {
					reject(new Error(`Fatal: unknown capture type: ${this.captureType}`));
				}
			}
		});
	}

	captureImageFromStream() {
		return new Promise((resolve, reject) => {
			this.imageCapture.takePhoto()
				.then(blob => createImageBitmap(blob))
				.then(imageBitmap => {
					// Create canvas in memory to grab still from stream
					let canvas;
					if (this.lastCanvas === 'a') {
						canvas = this.canvasB;
						this.lastCanvas = 'b';
					} else {
						canvas = this.canvasA;
						this.lastCanvas = 'a';
					}
					canvas.height = imageBitmap.height;
					canvas.width = imageBitmap.width;
					// console.log(`w: ${this.video.videoWidth}, h: ${this.video.videoHeight}`);
					let context = canvas.getContext('2d');

					// Capture still
					context.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);

					resolve();
				})
				.catch(err => reject(err));
		});
	}

	captureImageFromVideo() {
		// Create canvas in memory to grab still from stream
		let canvas;
		if (this.lastCanvas === 'a') {
			canvas = this.canvasB;
			this.lastCanvas = 'b';
		} else {
			canvas = this.canvasA;
			this.lastCanvas = 'a';
		}
		canvas.height = this.video.videoHeight;
		canvas.width = this.video.videoWidth;
		let context = canvas.getContext('2d');

		// Capture still
		context.drawImage(this.video, 0, 0, canvas.width, canvas.height);
	}

	renderMotionBar(isMotion) {
		if (!this.motionBarCanvas) return;

		let context = this.motionBarCanvas.getContext('2d');
		let imageData = context.getImageData(0, 0, this.motionBarCanvas.width, this.motionBarCanvas.height);
		let pixelIndex = this.motionBarPosition * 4;

		if (this.motionBarPosition >= this.motionBarCanvas.width) {
			// Shift first row 1px to left
			let subarray = imageData.data.subarray(4, this.motionBarCanvas.width * 4);
			imageData.data.set(subarray);

			// Set index to last pixel in first row
			pixelIndex = (this.motionBarCanvas.width - 1) * 4;
		}

		// Set first row last pixel data
		/*
		imageData.data[pixelIndex] = isMotion ? 0 : 255;
		imageData.data[pixelIndex+1] = isMotion ? 255 : 0;
		imageData.data[pixelIndex+2] = 0;
		imageData.data[pixelIndex+3] = 255;
		*/

		// Make movement red instead of green
		imageData.data[pixelIndex] = isMotion ? 150 : 0;
		imageData.data[pixelIndex+1] = isMotion ? 0 : 150;
		imageData.data[pixelIndex+2] = 0;
		imageData.data[pixelIndex+3] = 255;

		// Copy first row down
		let firstRowData = imageData.data.subarray(0, this.motionBarCanvas.width * 4);
		for (let i=1; i<this.motionBarCanvas.height; i++) {
			imageData.data.set(firstRowData, i * this.motionBarCanvas.width * 4);
		}

		// Render canvas
		context.putImageData(imageData, 0, 0);

		this.motionBarPosition++;
	}

	start() {
		this.isActive = true;
		this.captureImage();
	}

	stop() {
		this.isActive = false;
	}

	canImageCapture() {
		// Currently only supported in Chrome 61+
		// https://developer.mozilla.org/en-US/docs/Web/API/ImageCapture
		if (typeof(ImageCapture) === 'function') {
			console.log('Browser supports ImageCapture');
			return true;
		} else {
			console.log('Browser does NOT support ImageCapture');
			return false;
		}
	}
}
