jQuery(document).ready(function($){
    $('.toggler').on('click', function(){
        var $body = $('body');
        $body.toggleClass('hide-menu');
        if($body.hasClass("hide-menu")){
            setCookie('hideNav', 'true');
        } else {
            setCookie('hideNav', 'false');
        }
    })
});