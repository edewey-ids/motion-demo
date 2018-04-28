/* globals captureImage */
$(function() {
	// let img1 = document.getElementById('img1');
	// let img2 = document.getElementById('img2');
	let diffCanvas = document.getElementById('diff-canvas');
	// let diffCanvas = document.createElement('canvas');
	let video = document.getElementById('my-video');
	let diffWidth = 400;
	let diffHeight = 48;

	function rawDiff(img1data, img2data) {
		let img1 = new Image;
		let img2 = new Image;
		// Must defer this to wait for the second image to load. 
		// TODO: wait for both images to load to be sure. Maybe track a var for each and whichever loads last executes?
		img2.onload = () => {
			let ratio = img1.naturalWidth/img1.naturalHeight;
			diffHeight = diffWidth/ratio;
			// diffCanvas.width = Math.max(img1.naturalWidth * diffScale, img2.naturalWidth * diffScale);
			// diffCanvas.height = Math.max(img1.naturalHeight * diffScale, img2.naturalHeight * diffScale);
			diffCanvas.width = diffWidth;
			diffCanvas.height = diffHeight;
			diffCanvas.style.display = 'inline-block';

			let context = diffCanvas.getContext('2d');
			context.globalCompositeOperation = 'difference';
			context.clearRect(0, 0, diffCanvas.width, diffCanvas.height);
			context.drawImage(img1, 0, 0, diffCanvas.width, diffCanvas.height);
			context.drawImage(img2, 0, 0, diffCanvas.width, diffCanvas.height);
			/////

			// let context = diffCanvas.getContext('2d');

			if (diffCanvas.width === 0 || diffCanvas.height === 0) return;
			let imageData = context.getImageData(0, 0, diffCanvas.width, diffCanvas.height);
			// let rgba = imageData.data;
			// for (let i = 0; i < rgba.length; i += 4) {
			// 	let pixelDiff = rgba[i] * 0.3 + rgba[i + 1] * 0.6 + rgba[i + 2] * 0.1;
			// 	rgba[i] = 0;
			// 	rgba[i + 1] = pixelDiff;
			// 	rgba[i + 2] = 0;
			// }
			// console.log(rgba);
			let diff = processDiff(imageData);
			// console.log(diff);
			if (diffCallback) diffCallback(diff);

			// clear raw diff pixels and draw new mono diff pixels
			context.clearRect(0, 0, diffCanvas.width, diffCanvas.height);
			context.putImageData(imageData, 0, 0);
		};
		img1.src = img1data;
		img2.src = img2data;
	}

	function monoDiff(img1data, img2data) {
		// still need to do raw diff stuff first
		rawDiff(img1data, img2data);
	}


	let includeMotionPixels = false;
	let pixelDiffThreshold = 80;
	let includeMotionBox = false;
	let scoreThreshold = 15;
	let coords;
	let diffCallback;

	function processDiff(diffImageData) {
		var rgba = diffImageData.data;

		// pixel adjustments are done by reference directly on diffImageData
		var score = 0;
		var motionPixels = includeMotionPixels ? [] : undefined;
		var motionBox = undefined;
		for (var i = 0; i < rgba.length; i += 4) {
			var pixelDiff = rgba[i] * 0.3 + rgba[i + 1] * 0.6 + rgba[i + 2] * 0.1;
			var normalized = Math.min(255, pixelDiff * (255 / pixelDiffThreshold));
			rgba[i] = 0;
			rgba[i + 1] = normalized;
			rgba[i + 2] = 0;

			if (pixelDiff >= pixelDiffThreshold) {
				score++;
				coords = calculateCoordinates(i / 4);

				if (includeMotionBox) {
					motionBox = calculateMotionBox(motionBox, coords.x, coords.y);
				}

				if (includeMotionPixels) {
					motionPixels = calculateMotionPixels(motionPixels, coords.x, coords.y, pixelDiff);
				}

			}
		}

		// console.log(`${score}/${rgba.length/4} = ${score/(rgba.length/4)}`);

		return {
			score: score,
			motionBox: score > scoreThreshold ? motionBox : undefined,
			motionPixels: motionPixels,
			isMotion: score > scoreThreshold
		};
	}

	function calculateCoordinates(pixelIndex) {
		return {
			x: pixelIndex % diffWidth,
			y: Math.floor(pixelIndex / diffWidth)
		};
	}

	function calculateMotionBox(currentMotionBox, x, y) {
		// init motion box on demand
		var motionBox = currentMotionBox || {
			x: { min: coords.x, max: x },
			y: { min: coords.y, max: y }
		};

		motionBox.x.min = Math.min(motionBox.x.min, x);
		motionBox.x.max = Math.max(motionBox.x.max, x);
		motionBox.y.min = Math.min(motionBox.y.min, y);
		motionBox.y.max = Math.max(motionBox.y.max, y);

		return motionBox;
	}


	function calculateMotionPixels(motionPixels, x, y, pixelDiff) {
		motionPixels[x] = motionPixels[x] || [];
		motionPixels[x][y] = true;

		return motionPixels;
	}






	/**** non-lib stuff ****/
	/* globals CanvasJS */

	let diffImageData = ['',''];
	let diffInterval = 200;
	let motionDataCounter = 0;
	let motionScoreData = [];
	let isMotionData = [];
	let chart = new CanvasJS.Chart('chartContainer', {
		title: {
			text: 'Image diff score'
		},
		axisY: {
			includeZero: true
		},
		data: [
			{
				type: 'line',
				dataPoints: motionScoreData
			}
		]
	});

	function grabImages() {
		console.log('capturing img 1');
		let img1data = captureImage();
		// document.getElementById('img1').src = img1data;
		setTimeout(() => {
			console.log('capturing img 2');
			let img2data = captureImage();
			// document.getElementById('img2').src = img2data;
			// console.log('img1data ', img1data);
			// console.log('img2data ', img2data);
			// setTimeout(monoDiff.bind(this, img1data, img2data), 1000);
			monoDiff(img1data, img2data);
		}, diffInterval);
	}

	function grabImage() {
		diffImageData.push(captureImage());
		diffImageData.shift();
		monoDiff(diffImageData[0], diffImageData[1]);
	}


	$('#diff-button').click(() => {
		diffCallback = updateChart;
		setInterval(grabImage, diffInterval);
	});

	let diffCanvas2 = document.getElementById('diff-canvas2');
	// diffCanvas2.width = 50;
	// diffCanvas2.height = 5;

	function updateChart(data) {
		motionScoreData.push({
			x: motionDataCounter,
			// y: data.isMotion === true ? 1 : 0
			y: data.score / (diffWidth * diffHeight)
		});
		if (motionScoreData.length > 100) motionScoreData.shift();
		// console.log(`${data.score}/(${diffWidth}*${diffHeight})=${data.score/(diffWidth*diffHeight)}`);
		chart.render();

		// Render analysis bar to canvas
		renderMotionAnalysis(diffCanvas2, data.isMotion, motionDataCounter);

		motionDataCounter++;
	}

	// function renderMotionAnalysis(canvas, isMotion, xpos) {
	// 	let context = canvas.getContext('2d');
	// 	let imageData = context.getImageData(0, 0, canvas.width, canvas.height);
	// 	let firstPixelLastRow = (canvas.height - 1) * 4;
	// 	let pixelIndex = firstPixelLastRow + (xpos * 4);

	// 	if (xpos >= canvas.width) {
	// 		// Shift last row 1px to left
	// 		imageData.data.copyWithin(firstPixelLastRow, firstPixelLastRow + 4);
	// 		// Set index to last pixel
	// 		pixelIndex = imageData.data.length - 4;
	// 	}

	// 	imageData.data[pixelIndex] = isMotion ? 0 : 255;
	// 	imageData.data[pixelIndex+1] = isMotion ? 255 : 0;
	// 	imageData.data[pixelIndex+2] = 0;
	// 	imageData.data[pixelIndex+3] = 255;

	// 	context.putImageData(imageData, 0, 0);
	// }

	function renderMotionAnalysis(canvas, isMotion, xpos) {
		let context = canvas.getContext('2d');
		let imageData = context.getImageData(0, 0, canvas.width, canvas.height);
		let pixelIndex = xpos * 4;

		if (xpos >= canvas.width) {
			// Shift first row 1px to left
			let subarray = imageData.data.subarray(4, canvas.width * 4);
			imageData.data.set(subarray);

			// Set index to last pixel in first row
			pixelIndex = (canvas.width - 1) * 4;
		}

		// Set first row last pixel data
		imageData.data[pixelIndex] = isMotion ? 0 : 255;
		imageData.data[pixelIndex+1] = isMotion ? 255 : 0;
		imageData.data[pixelIndex+2] = 0;
		imageData.data[pixelIndex+3] = 255;

		// Copy first row down
		let firstRowData = imageData.data.subarray(0, canvas.width * 4);
		for (let i=1; i<canvas.height; i++) {
			//imageData.data.copyWithin(i * canvas.width * 4, 0, canvas.width * 4);
			imageData.data.set(firstRowData, i * canvas.width * 4);
		}

		context.putImageData(imageData, 0, 0);
	}
});
