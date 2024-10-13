jQuery(function ($) {
    let timeOut = 0
    if (!$('body').hasClass("hide-menu")) {
        $('.sidebar .toggler').trigger('click')
        timeOut = 350
    }

    setTimeout(function () {

        const driver = window?.driver.js.driver;
        if (driver) {

            const driverObj = driver({
                popoverClass: 'driverjs-theme',
                showProgress: true,
                steps: [
                    { element: $('.my-dtr.active:eq(0)')[0], popover: { title: 'View DTR', description: 'These panels lead to your Daily Time Records.' } },
                    { element: '.main .toggler', popover: { title: 'Menu', description: 'This button opens the sidebar.' } },
                    {
                        element: '#sidebar', popover: { title: 'Sidebar', description: 'The sidebar contains all the features that HRIS offers.' }, onHighlightStarted: function () {
                            $('.main .toggler').trigger('click')
                        }
                    },
                    { element: '#nav-item-help a', popover: { title: 'What is Next?', description: 'Click this link to watch the onboarding videos.' } },
                ],

            });

            driverObj.drive();
        }
    }, timeOut)

    setCookie('firstRun', 'false', 365);
});

