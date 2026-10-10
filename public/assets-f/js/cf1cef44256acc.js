jQuery(function($){
	$(document).on('click', '.post-query__filter-btn', function(){
		var $button = $(this);
		var $section = $button.closest('.post-query');

		$section.find('.post-query__filter-btn').removeClass('post-query__filter-btn--active');
		$button.addClass('post-query__filter-btn--active');

		var term = $button.data('term');

		$.ajax({
			url: ajaxfilter.ajax_url,
			type: 'POST',
			data: {
				action: 'filter_posts',
				category: term,
				post_type: $section.data('post-type'),
				taxonomy: $section.data('taxonomy'),
				slider_or_grid: $section.data('slider-or-grid'),
				posts_per_page: $section.data('posts-per-page'),
				overlay_color: $section.data('overlay-color')
			},
			success: function(response){
				$section.find('.ajax').html(response);

				if ($section.data('slider-or-grid') === 'slider') {
					new Swiper($section.find('.swiper')[0], {
						slidesPerView: parseInt($section.data('slides-per-view')) || 1,
						loop: true,
						scrollbar: { el: '.swiper-scrollbar' },
						navigation: {
							nextEl: '.swiper-button-next',
							prevEl: '.swiper-button-prev',
						},
						autoplay: $section.data('autoplay') === 'true'
								? { delay: parseInt($section.data('delay')) || 3000 }
								: false
					});
				}
			}
		});
	});
});
