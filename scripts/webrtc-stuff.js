/* globals MotionLib */

// Get list of devices
navigator.mediaDevices.enumerateDevices()
	.then((deviceInfos) => {
		for (var i = 0; i !== deviceInfos.length; ++i) {
			var deviceInfo = deviceInfos[i];
			var option = document.createElement('option');
			option.value = deviceInfo.deviceId;
			console.log(`[${deviceInfo.kind}] ${deviceInfo.label} (${deviceInfo.deviceId})`);
			if (deviceInfo.kind === 'videoinput') {
				// Add all webcams to UI
				addWebcam(deviceInfo);
			}
		}
	})
	.catch((err) => {
		if (err.name === 'PermissionDeniedError') console.error('Camera permission denied');
		console.error(err);
	});

function addWebcam(deviceInfo) {
	// Get user media for webcam
	navigator.mediaDevices.getUserMedia({
		audio: false,
		video: {
			deviceId: deviceInfo.deviceId
		}
	})
		.then((stream) => {
			let videoTracks = stream.getVideoTracks();
			console.log(`Using camera: ${videoTracks[0].label}`);
			stream.oninactive = function() {
				console.log(`Stream inactive (${videoTracks[0].label})`);
			};

			// Create video element
			let vid = document.createElement('video');
			vid.setAttribute('autoplay', true);
			vid.setAttribute('playsinline', true);

			let streaming = false;
			let width = 320;
			let height = 0;

			vid.srcObject = stream;
			vid.addEventListener('canplay', () => {
				if (!streaming) {
					// Initialize video display
					height = vid.videoHeight / (vid.videoWidth / width);

					if (isNaN(height)) {
						height = width / (4/3);
					}

					vid.setAttribute('width', width);
					vid.setAttribute('height', height);
					streaming = true;
				}
			}, false);

			// Create parent container for all elements for this webcam
			let container = $('<div>');
			container.append(vid);

			// Create debug canvas
			let diffCanvas = document.createElement('canvas');
			container.append(diffCanvas);

			// Create motion bar canvas
			let motionBarCanvas = document.createElement('canvas');
			container.append(motionBarCanvas);

			// Add to UI
			$('#videos').append(container);

			// Initialize motionlib for webcam
			let motionLib = new MotionLib({
				id: videoTracks[0].label,
				video: vid,
				// mediaStream: stream,
				diffCanvas: diffCanvas,
				diffWidth: 200,
				diffHeight: 200,
				motionBarCanvas: motionBarCanvas,
				interval: 200,
				onDiff: (data) => {
				//	console.log(data);
					if (data.isMotion) {
						$("#videos video").addClass("motion-border");
					}
					else {
						$("#videos video").removeClass("motion-border");
					}
				}
			});

$("#closeMotionDemo").before("<div class='input-group mt-4'><input id='thresholdInput' class='form-control' type='text' placeholder='Set custom threshold'><button id='thresholdButton' class='ml-1 btn btn-nav-teal' type='button'>Set</button></div>");
$("#thresholdButton").click(function () {
	var customThresholdScore = $("#thresholdInput").val();
	motionLib.scoreThreshold = customThresholdScore;

});

			// Check to see if browser supports direct capture from stream
			motionLib.canImageCapture();

			// Start diffing
			motionLib.start();
		})
		.catch((err) => {
			if (err.name === 'PermissionDeniedError') console.error('Camera permission denied');
			console.error(err);
		});
}
