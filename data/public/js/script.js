jQuery(document).ready(function ($) {
    var $body = $('body');

    $('.toggler').on('click', function () {
        $body.toggleClass('hide-menu');
        if ($body.hasClass("hide-menu")) {
            setCookie('hideNav', 'true');
        } else {
            setCookie('hideNav', 'false');
        }
    })
    $('.nav-employee a').on('click', function () {
        $body.addClass('hide-menu');
        setCookie('hideNav', 'true');

    })

});

