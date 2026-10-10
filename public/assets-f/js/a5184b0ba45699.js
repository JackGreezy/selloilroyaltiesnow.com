/**
 * Make the bottom wording fit the entire width
 */
document.addEventListener('DOMContentLoaded', () => {
	function fitTextToWidth(selector) {
		const el = document.querySelector(selector);
		if (!el || !el.parentElement) return;
		const parent = el.parentElement;

		let fontSize = 10;
		el.style.fontSize = fontSize + 'px';

		while (el.scrollWidth <= parent.offsetWidth && fontSize < 300) {
			fontSize += 1;
			el.style.fontSize = fontSize + 'px';
		}

		el.style.fontSize = (fontSize - 1) + 'px';
	}

	fitTextToWidth('.site-footer__keywords');

	const el = document.querySelector('.site-footer__keywords');
	if (el && el.parentElement) {
		const ro = new ResizeObserver(() => fitTextToWidth('.site-footer__keywords'));
		ro.observe(el.parentElement);
	}

	initFooterYoutube();
});

function initFooterYoutube() {
	const iframes = Array.from(document.querySelectorAll('.site-footer__youtube-iframe[data-youtube-id]'));
	if (!iframes.length) return;

	const players = new Map();
	const loopWatchers = new Map();
	const youtubeAspectRatio = 16 / 9;
	const loopThresholdSeconds = 0.35;

	function fitIframeCover(iframe) {
		const container = iframe.closest('.site-footer__media');
		if (!container) return;

		const { width: containerWidth, height: containerHeight } = container.getBoundingClientRect();
		if (!containerWidth || !containerHeight) return;

		const containerRatio = containerWidth / containerHeight;
		let width = 0;
		let height = 0;

		if (containerRatio > youtubeAspectRatio) {
			width = containerWidth;
			height = containerWidth / youtubeAspectRatio;
		} else {
			height = containerHeight;
			width = containerHeight * youtubeAspectRatio;
		}

		iframe.style.animation = 'none';
		iframe.style.opacity = '1';
		iframe.style.width = `${width}px`;
		iframe.style.height = `${height}px`;
		iframe.style.left = '50%';
		iframe.style.top = '0';
		iframe.style.transform = 'translateX(-50%)';
	}

	function startSmoothLoop(player, iframe) {
		if (loopWatchers.has(iframe)) return;

		const intervalId = window.setInterval(() => {
			if (typeof player.getDuration !== 'function' || typeof player.getCurrentTime !== 'function') return;

			const duration = player.getDuration();
			const currentTime = player.getCurrentTime();
			if (!duration || !currentTime) return;

			if (duration - currentTime <= loopThresholdSeconds) {
				player.seekTo(0, true);
				player.playVideo();
			}
		}, 250);

		loopWatchers.set(iframe, intervalId);
	}

	function handleReady(player, iframe) {
		if (typeof player.mute === 'function') player.mute();
		if (typeof player.setVolume === 'function') player.setVolume(0);
		if (typeof player.playVideo === 'function') player.playVideo();
		fitIframeCover(iframe);
		startSmoothLoop(player, iframe);
	}

	function handleStateChange(event, player) {
		if (!window.YT || !window.YT.PlayerState) return;
		if (event.data === window.YT.PlayerState.ENDED) {
			player.seekTo(0, true);
			player.playVideo();
		}
	}

	function initPlayers() {
		if (!window.YT || typeof window.YT.Player !== 'function') return;

		iframes.forEach((iframe) => {
			if (players.has(iframe)) return;

			const player = new window.YT.Player(iframe, {
				events: {
					onReady: () => handleReady(player, iframe),
					onStateChange: (event) => handleStateChange(event, player),
				},
			});

			players.set(iframe, player);
			fitIframeCover(iframe);
		});
	}

	const handleResize = () => {
		iframes.forEach(fitIframeCover);
	};

	window.addEventListener('resize', handleResize, { passive: true });
	window.addEventListener('orientationchange', handleResize, { passive: true });
	if (window.visualViewport) {
		window.visualViewport.addEventListener('resize', handleResize, { passive: true });
	}
	if (typeof ResizeObserver === 'function') {
		const ro = new ResizeObserver(handleResize);
		iframes.forEach((iframe) => {
			const container = iframe.closest('.site-footer__media');
			if (container) ro.observe(container);
		});
	}

	if (window.YT && typeof window.YT.Player === 'function') {
		handleResize();
		initPlayers();
		return;
	}

	handleResize();
	window.requestAnimationFrame(handleResize);

	const previousApiReady = window.onYouTubeIframeAPIReady;
	window.onYouTubeIframeAPIReady = () => {
		if (typeof previousApiReady === 'function') previousApiReady();
		initPlayers();
	};

	if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
		const script = document.createElement('script');
		script.src = 'https://www.youtube.com/iframe_api';
		script.async = true;
		document.head.appendChild(script);
	}
}
