define(['browser'], function (browser) {

    var allPages = document.querySelectorAll('.mainAnimatedPage');
    var pageContainerCount = allPages.length;
    var animationDuration = 500;
    var allowAnimation = true;
    var selectedPageIndex = -1;

    function enableAnimation() {

        if (!allowAnimation) {
            return false;
        }
        if (browser.tv) {
            return false;
        }

        return true;
    }

    function loadView(options) {

        if (options.cancel) {
            return;
        }

        cancelActiveAnimations();

        var selected = getSelectedIndex(allPages);
        var previousAnimatable = selected == -1 ? null : allPages[selected];
        var pageIndex = selected + 1;

        if (pageIndex >= pageContainerCount) {
            pageIndex = 0;
        }

        var newViewInfo = normalizeNewView(options);
        var newView = newViewInfo.elem;

        var dependencies = typeof (newView) == 'string' ? null : newView.getAttribute('data-require');
        dependencies = dependencies ? dependencies.split(',') : [];

        var isPluginpage = options.url.toLowerCase().indexOf('/configurationpage?') != -1;

        if (isPluginpage) {
            dependencies.push('jqmpopup');
            dependencies.push('jqmcollapsible');
            dependencies.push('jqmcheckbox');
            dependencies.push('legacy/dashboard');
            dependencies.push('legacy/selectmenu');
            dependencies.push('jqmcontrolgroup');
        }

        if (isPluginpage || (newView.classList && newView.classList.contains('type-interior'))) {
            dependencies.push('jqmlistview');
            dependencies.push('scripts/notifications');
        }

        return new Promise(function (resolve, reject) {

            require(dependencies, function () {

                var animatable = allPages[pageIndex];

                var currentPage = animatable.querySelector('.page-view');

                if (currentPage) {
                    triggerDestroy(currentPage);
                }

                var view;

                if (typeof (newView) == 'string') {
                    animatable.innerHTML = newView;
                    view = animatable.querySelector('.page-view');
                } else {
                    if (newViewInfo.hasScript) {
                        // TODO: figure this out without jQuery
                        animatable.innerHTML = '';
                        $(newView).appendTo(animatable);
                    } else {
                        if (currentPage) {
                            animatable.replaceChild(newView, currentPage);
                        } else {
                            animatable.appendChild(newView);
                        }
                    }
                    enhanceNewView(dependencies, newView);
                    view = newView;
                }

                if (onBeforeChange) {
                    onBeforeChange(view, false, options);
                }

                beforeAnimate(allPages, pageIndex, selected);
                // animate here
                animate(animatable, previousAnimatable, options.transition, options.isBack).then(function () {

                    selectedPageIndex = pageIndex;
                    if (!options.cancel && previousAnimatable) {
                        afterAnimate(allPages, pageIndex);
                    }

                    $.mobile = $.mobile || {};
                    $.mobile.activePage = view;

                    resolve(view);
                });
            });
        });
    }

    function enhanceNewView(dependencies, newView) {

        var hasJqm = false;

        for (var i = 0, length = dependencies.length; i < length; i++) {
            if (dependencies[i].indexOf('jqm') == 0) {
                hasJqm = true;
                break;
            }
        }

        if (hasJqm) {
            $(newView).trigger('create');
        }
    }

    function replaceAll(str, find, replace) {

        return str.split(find).join(replace);
    }

    function parseHtml(html, hasScript) {

        if (hasScript) {
            html = replaceAll(html, '<!--<script', '<script');
            html = replaceAll(html, '</script>-->', '</script>');
        }

        var wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        return wrapper.querySelector('div[data-role="page"]');
    }

    function normalizeNewView(options) {

        if (options.view.indexOf('data-role="page"') == -1) {
            var html = '<div class="page-view" data-type="' + (options.type || '') + '" data-url="' + options.url + '">';
            html += options.view;
            html += '</div>';
            return html;
        }

        var hasScript = options.view.indexOf('<script') != -1;

        var elem = parseHtml(options.view, hasScript);
        elem.classList.add('page-view');
        elem.setAttribute('data-type', options.type || '');
        elem.setAttribute('data-url', options.url);
        return {
            elem: elem,
            hasScript: hasScript
        };
    }

    function beforeAnimate(allPages, newPageIndex, oldPageIndex) {
        for (var i = 0, length = allPages.length; i < length; i++) {
            if (newPageIndex == i || oldPageIndex == i) {
                //allPages[i].classList.remove('hide');
            } else {
                allPages[i].classList.add('hide');
            }
        }
    }

    function afterAnimate(allPages, newPageIndex) {
        for (var i = 0, length = allPages.length; i < length; i++) {
            if (newPageIndex == i) {
                //allPages[i].classList.remove('hide');
            } else {
                allPages[i].classList.add('hide');
            }
        }
    }

    function animate(newAnimatedPage, oldAnimatedPage, transition, isBack) {

        if (enableAnimation() && newAnimatedPage.animate) {
            if (transition == 'slide') {
                return slide(newAnimatedPage, oldAnimatedPage, transition, isBack);
            } else if (transition == 'fade') {
                return fade(newAnimatedPage, oldAnimatedPage, transition, isBack);
            }
        }

        return nullAnimation(newAnimatedPage, oldAnimatedPage, transition, isBack);
    }

    function nullAnimation(newAnimatedPage, oldAnimatedPage, transition, isBack) {

        newAnimatedPage.classList.remove('hide');
        return Promise.resolve();
    }

    function slide(newAnimatedPage, oldAnimatedPage, transition, isBack) {

        var timings = {
            duration: 450,
            iterations: 1,
            easing: 'ease-out',
            fill: 'both'
        }

        var animations = [];

        if (oldAnimatedPage) {
            var destination = isBack ? '100%' : '-100%';

            animations.push(oldAnimatedPage.animate([

              { transform: 'none', offset: 0 },
              { transform: 'translate3d(' + destination + ', 0, 0)', offset: 1 }

            ], timings));
        }

        newAnimatedPage.classList.remove('hide');

        var start = isBack ? '-100%' : '100%';

        animations.push(newAnimatedPage.animate([

          { transform: 'translate3d(' + start + ', 0, 0)', offset: 0 },
          { transform: 'none', offset: 1 }

        ], timings));

        currentAnimations = animations;

        return new Promise(function (resolve, reject) {
            animations[animations.length - 1].onfinish = resolve;
        });
    }

    function fade(newAnimatedPage, oldAnimatedPage, transition, isBack) {

        var timings = {
            duration: animationDuration,
            iterations: 1,
            easing: 'ease-out',
            fill: 'both'
        }

        var animations = [];

        if (oldAnimatedPage) {
            animations.push(oldAnimatedPage.animate([

              { opacity: 1, offset: 0 },
              { opacity: 0, offset: 1 }

            ], timings));
        }

        newAnimatedPage.classList.remove('hide');

        animations.push(newAnimatedPage.animate([

              { opacity: 0, offset: 0 },
              { opacity: 1, offset: 1 }

        ], timings));

        currentAnimations = animations;

        return new Promise(function (resolve, reject) {
            animations[animations.length - 1].onfinish = resolve;
        });
    }

    var currentAnimations = [];
    function cancelActiveAnimations() {

        var animations = currentAnimations;
        for (var i = 0, length = animations.length; i < length; i++) {
            cancelAnimation(animations[i]);
        }
    }

    function cancelAnimation(animation) {

        try {
            animation.cancel();
        } catch (err) {
            console.log('Error canceling animation: ' + err);
        }
    }

    var onBeforeChange;
    function setOnBeforeChange(fn) {
        onBeforeChange = fn;
    }

    function sendResolve(resolve, view) {

        // Don't report completion until the animation has finished, otherwise rendering may not perform well
        setTimeout(function () {

            resolve(view);

        }, animationDuration);
    }

    function getSelectedIndex(allPages) {

        return selectedPageIndex;
    }

    function tryRestoreView(options) {

        var url = options.url;
        var view = document.querySelector(".page-view[data-url='" + url + "']");
        var page = parentWithClass(view, 'mainAnimatedPage');

        if (view) {

            var index = -1;
            var pages = allPages;
            for (var i = 0, length = pages.length; i < length; i++) {
                if (pages[i] == page) {
                    index = i;
                    break;
                }
            }

            if (index != -1) {

                if (options.cancel) {
                    return;
                }

                cancelActiveAnimations();

                var animatable = allPages[index];
                var selected = getSelectedIndex(allPages);
                var previousAnimatable = selected == -1 ? null : allPages[selected];

                if (onBeforeChange) {
                    onBeforeChange(view, true, options);
                }

                beforeAnimate(allPages, index, selected);

                return animate(animatable, previousAnimatable, options.transition, options.isBack).then(function () {

                    selectedPageIndex = index;
                    if (!options.cancel && previousAnimatable) {
                        afterAnimate(allPages, index);
                    }

                    $.mobile = $.mobile || {};
                    $.mobile.activePage = view;

                    return view;
                });
            }
        }

        return Promise.reject();
    }

    function triggerDestroy(view) {
        view.dispatchEvent(new CustomEvent("viewdestroy", {}));
    }

    function reset() {

        var views = document.querySelectorAll(".mainAnimatedPage.hide .page-view");

        for (var i = 0, length = views.length; i < length; i++) {

            var view = views[i];
            triggerDestroy(view);
            view.parentNode.removeChild(view);
        }
    }

    function parentWithClass(elem, className) {

        while (!elem.classList || !elem.classList.contains(className)) {
            elem = elem.parentNode;

            if (!elem) {
                return null;
            }
        }

        return elem;
    }

    function init(isAnimationAllowed) {

        if (allowAnimation && enableAnimation() && !browser.animate) {
            require(['webAnimations']);
        }
    }

    return {
        loadView: loadView,
        tryRestoreView: tryRestoreView,
        reset: reset,
        setOnBeforeChange: setOnBeforeChange,
        init: init
    };
});