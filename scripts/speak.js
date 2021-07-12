// node scripts/speak.js
const say = require('say');

    // or, override the platform
    // const Say = require('say').Say
    // const say = new Say('darwin' || 'win32' || 'linux');

; (async () => {
    try {
        // Use default system voice and speed
        say.speak('Good morning. Your login time is 7:42 AM. Please dont forget your health declaration form. Thank you.', null, 1.0, (err) => {
            if (err) {
                return console.error(err)
            }
            say.speak('Good bye. Your logout time is 12:42 PM.', null, 1.0)
        });

    } catch (err) {
        console.log(err)
    } finally {
    }
})()