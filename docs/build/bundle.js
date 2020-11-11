
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_in_transition(node, fn, params) {
        let config = fn(node, params);
        let running = false;
        let animation_name;
        let task;
        let uid = 0;
        function cleanup() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
            tick(0, 1);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            if (task)
                task.abort();
            running = true;
            add_render_callback(() => dispatch(node, true, 'start'));
            task = loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(1, 0);
                        dispatch(node, true, 'end');
                        cleanup();
                        return running = false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(t, 1 - t);
                    }
                }
                return running;
            });
        }
        let started = false;
        return {
            start() {
                if (started)
                    return;
                delete_rule(node);
                if (is_function(config)) {
                    config = config();
                    wait().then(go);
                }
                else {
                    go();
                }
            },
            invalidate() {
                started = false;
            },
            end() {
                if (running) {
                    cleanup();
                    running = false;
                }
            }
        };
    }
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = program.b - t;
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program || pending_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.29.7' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/Components/Navbar.svelte generated by Svelte v3.29.7 */

    const file = "src/Components/Navbar.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	return child_ctx;
    }

    // (59:4) {:else}
    function create_else_block(ctx) {
    	let a;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			a = element("a");
    			a.textContent = "Log in";
    			attr_dev(a, "class", "btn btn-light text-reset");
    			attr_dev(a, "href", "#");
    			add_location(a, file, 59, 6, 1970);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);

    			if (!mounted) {
    				dispose = listen_dev(a, "click", /*click_handler_2*/ ctx[5], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(59:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (12:4) {#if isLoggedin}
    function create_if_block(ctx) {
    	let button;
    	let span0;
    	let t0;
    	let div;
    	let ul;
    	let li0;
    	let a0;
    	let t2;
    	let li1;
    	let a1;
    	let t4;
    	let li2;
    	let a2;
    	let t6;
    	let span1;
    	let t8;
    	let if_block_anchor;
    	let if_block = /*currentEvent*/ ctx[1] && create_if_block_1(ctx);

    	const block = {
    		c: function create() {
    			button = element("button");
    			span0 = element("span");
    			t0 = space();
    			div = element("div");
    			ul = element("ul");
    			li0 = element("li");
    			a0 = element("a");
    			a0.textContent = "Home";
    			t2 = space();
    			li1 = element("li");
    			a1 = element("a");
    			a1.textContent = "Features";
    			t4 = space();
    			li2 = element("li");
    			a2 = element("a");
    			a2.textContent = "Pricing";
    			t6 = space();
    			span1 = element("span");
    			span1.textContent = "Navbar text with an inline element";
    			t8 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr_dev(span0, "class", "navbar-toggler-icon");
    			add_location(span0, file, 20, 8, 572);
    			attr_dev(button, "class", "navbar-toggler");
    			attr_dev(button, "type", "button");
    			attr_dev(button, "data-toggle", "collapse");
    			attr_dev(button, "data-target", "#navbarText");
    			attr_dev(button, "aria-controls", "navbarText");
    			attr_dev(button, "aria-expanded", "false");
    			attr_dev(button, "aria-label", "Toggle navigation");
    			add_location(button, file, 12, 6, 333);
    			attr_dev(a0, "class", "nav-link active");
    			attr_dev(a0, "aria-current", "page");
    			attr_dev(a0, "href", "#");
    			add_location(a0, file, 25, 12, 783);
    			attr_dev(li0, "class", "nav-item");
    			add_location(li0, file, 24, 10, 749);
    			attr_dev(a1, "class", "nav-link");
    			attr_dev(a1, "href", "#");
    			add_location(a1, file, 27, 31, 895);
    			attr_dev(li1, "class", "nav-item");
    			add_location(li1, file, 27, 10, 874);
    			attr_dev(a2, "class", "nav-link");
    			attr_dev(a2, "href", "#");
    			add_location(a2, file, 28, 31, 973);
    			attr_dev(li2, "class", "nav-item");
    			add_location(li2, file, 28, 10, 952);
    			attr_dev(ul, "class", "navbar-nav mr-auto mb-2 mb-lg-0");
    			add_location(ul, file, 23, 8, 694);
    			attr_dev(span1, "class", "navbar-text");
    			add_location(span1, file, 30, 8, 1041);
    			attr_dev(div, "class", "collapse navbar-collapse");
    			attr_dev(div, "id", "navbarText");
    			add_location(div, file, 22, 6, 631);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, span0);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, ul);
    			append_dev(ul, li0);
    			append_dev(li0, a0);
    			append_dev(ul, t2);
    			append_dev(ul, li1);
    			append_dev(li1, a1);
    			append_dev(ul, t4);
    			append_dev(ul, li2);
    			append_dev(li2, a2);
    			append_dev(div, t6);
    			append_dev(div, span1);
    			insert_dev(target, t8, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*currentEvent*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t8);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(12:4) {#if isLoggedin}",
    		ctx
    	});

    	return block;
    }

    // (33:6) {#if currentEvent}
    function create_if_block_1(ctx) {
    	let div1;
    	let button;
    	let t0_value = (/*currentEvent*/ ctx[1] ?? "All") + "";
    	let t0;
    	let t1;
    	let div0;
    	let h6;
    	let t3;
    	let each_value = /*events*/ ctx[2];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			button = element("button");
    			t0 = text(t0_value);
    			t1 = space();
    			div0 = element("div");
    			h6 = element("h6");
    			h6.textContent = "Event";
    			t3 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(button, "class", "btn btn-outline-light dropdown-toggle");
    			attr_dev(button, "type", "button");
    			attr_dev(button, "id", "navbarDropdown");
    			attr_dev(button, "data-toggle", "dropdown");
    			attr_dev(button, "aria-haspopup", "true");
    			attr_dev(button, "aria-expanded", "false");
    			add_location(button, file, 34, 10, 1190);
    			attr_dev(h6, "class", "dropdown-header");
    			add_location(h6, file, 46, 12, 1600);
    			attr_dev(div0, "class", "dropdown-menu dropdown-menu-right");
    			attr_dev(div0, "aria-labelledby", "navbarDropdown");
    			add_location(div0, file, 43, 10, 1483);
    			attr_dev(div1, "class", "dropdown");
    			add_location(div1, file, 33, 8, 1157);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, button);
    			append_dev(button, t0);
    			append_dev(div1, t1);
    			append_dev(div1, div0);
    			append_dev(div0, h6);
    			append_dev(div0, t3);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*currentEvent*/ 2 && t0_value !== (t0_value = (/*currentEvent*/ ctx[1] ?? "All") + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*currentEvent, events*/ 6) {
    				each_value = /*events*/ ctx[2];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div0, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(33:6) {#if currentEvent}",
    		ctx
    	});

    	return block;
    }

    // (49:14) {#if e !== currentEvent}
    function create_if_block_2(ctx) {
    	let button;
    	let t_value = /*e*/ ctx[6] + "";
    	let t;
    	let mounted;
    	let dispose;

    	function click_handler_1() {
    		return /*click_handler_1*/ ctx[4](/*e*/ ctx[6]);
    	}

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text(t_value);
    			attr_dev(button, "class", "dropdown-item");
    			attr_dev(button, "href", "#");
    			add_location(button, file, 49, 16, 1726);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", click_handler_1, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(49:14) {#if e !== currentEvent}",
    		ctx
    	});

    	return block;
    }

    // (48:12) {#each events as e}
    function create_each_block(ctx) {
    	let if_block_anchor;
    	let if_block = /*e*/ ctx[6] !== /*currentEvent*/ ctx[1] && create_if_block_2(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*e*/ ctx[6] !== /*currentEvent*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_2(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(48:12) {#each events as e}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let nav;
    	let div1;
    	let div0;
    	let t1;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*isLoggedin*/ ctx[0]) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			nav = element("nav");
    			div1 = element("div");
    			div0 = element("div");
    			div0.textContent = "Cube Competitions";
    			t1 = space();
    			if_block.c();
    			attr_dev(div0, "class", "navbar-brand");
    			add_location(div0, file, 8, 4, 207);
    			attr_dev(div1, "class", "container-fluid");
    			add_location(div1, file, 7, 2, 173);
    			attr_dev(nav, "class", "navbar navbar-dark bg-dark fixed-top");
    			add_location(nav, file, 6, 0, 120);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, nav, anchor);
    			append_dev(nav, div1);
    			append_dev(div1, div0);
    			append_dev(div1, t1);
    			if_block.m(div1, null);

    			if (!mounted) {
    				dispose = listen_dev(div0, "click", /*click_handler*/ ctx[3], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div1, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(nav);
    			if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Navbar", slots, []);
    	let { isLoggedin } = $$props;
    	let { currentEvent } = $$props;
    	const events = ["333", "222", "444", "minx"];
    	const writable_props = ["isLoggedin", "currentEvent"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Navbar> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => $$invalidate(1, currentEvent = "");
    	const click_handler_1 = e => $$invalidate(1, currentEvent = e);
    	const click_handler_2 = () => $$invalidate(0, isLoggedin = !isLoggedin);

    	$$self.$$set = $$props => {
    		if ("isLoggedin" in $$props) $$invalidate(0, isLoggedin = $$props.isLoggedin);
    		if ("currentEvent" in $$props) $$invalidate(1, currentEvent = $$props.currentEvent);
    	};

    	$$self.$capture_state = () => ({ isLoggedin, currentEvent, events });

    	$$self.$inject_state = $$props => {
    		if ("isLoggedin" in $$props) $$invalidate(0, isLoggedin = $$props.isLoggedin);
    		if ("currentEvent" in $$props) $$invalidate(1, currentEvent = $$props.currentEvent);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		isLoggedin,
    		currentEvent,
    		events,
    		click_handler,
    		click_handler_1,
    		click_handler_2
    	];
    }

    class Navbar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { isLoggedin: 0, currentEvent: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Navbar",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*isLoggedin*/ ctx[0] === undefined && !("isLoggedin" in props)) {
    			console.warn("<Navbar> was created without expected prop 'isLoggedin'");
    		}

    		if (/*currentEvent*/ ctx[1] === undefined && !("currentEvent" in props)) {
    			console.warn("<Navbar> was created without expected prop 'currentEvent'");
    		}
    	}

    	get isLoggedin() {
    		throw new Error("<Navbar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isLoggedin(value) {
    		throw new Error("<Navbar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get currentEvent() {
    		throw new Error("<Navbar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set currentEvent(value) {
    		throw new Error("<Navbar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fade(node, { delay = 0, duration = 400, easing = identity }) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }
    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 }) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
        };
    }

    /* src/Components/Login.svelte generated by Svelte v3.29.7 */
    const file$1 = "src/Components/Login.svelte";

    function create_fragment$1(ctx) {
    	let main;
    	let h1;
    	let t1;
    	let p;
    	let main_intro;

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "Cube Competitions";
    			t1 = space();
    			p = element("p");
    			p.textContent = "You must log in to discord to continue";
    			attr_dev(h1, "class", "svelte-1tdknn5");
    			add_location(h1, file$1, 17, 2, 245);
    			add_location(p, file$1, 18, 2, 274);
    			attr_dev(main, "class", "svelte-1tdknn5");
    			add_location(main, file$1, 16, 0, 199);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(main, t1);
    			append_dev(main, p);
    		},
    		p: noop,
    		i: function intro(local) {
    			if (!main_intro) {
    				add_render_callback(() => {
    					main_intro = create_in_transition(main, fly, { y: -150, duration: 3000 });
    					main_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Login", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Login> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ fly });
    	return [];
    }

    class Login extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Login",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src/Components/Dashboard.svelte generated by Svelte v3.29.7 */
    const file$2 = "src/Components/Dashboard.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[3] = list[i];
    	return child_ctx;
    }

    // (22:4) {#each events as e}
    function create_each_block$1(ctx) {
    	let div2;
    	let div1;
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let t0;
    	let div0;
    	let h4;
    	let t1_value = /*e*/ ctx[3] + "";
    	let t1;
    	let t2;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[2](/*e*/ ctx[3]);
    	}

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			img = element("img");
    			t0 = space();
    			div0 = element("div");
    			h4 = element("h4");
    			t1 = text(t1_value);
    			t2 = space();
    			if (img.src !== (img_src_value = "img/" + /*e*/ ctx[3] + ".svg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "class", "card-img-top");
    			attr_dev(img, "alt", img_alt_value = /*e*/ ctx[3]);
    			add_location(img, file$2, 24, 10, 676);
    			attr_dev(h4, "class", "");
    			add_location(h4, file$2, 26, 12, 794);
    			attr_dev(div0, "class", "card-footer bg-transparent");
    			add_location(div0, file$2, 25, 10, 741);
    			attr_dev(div1, "class", "card svelte-81ewok");
    			add_location(div1, file$2, 23, 8, 611);
    			attr_dev(div2, "class", "col mt-4");
    			add_location(div2, file$2, 22, 6, 580);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);
    			append_dev(div1, img);
    			append_dev(div1, t0);
    			append_dev(div1, div0);
    			append_dev(div0, h4);
    			append_dev(h4, t1);
    			append_dev(div2, t2);

    			if (!mounted) {
    				dispose = listen_dev(div1, "click", click_handler, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(22:4) {#each events as e}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div1;
    	let div0;
    	let div1_transition;
    	let current;
    	let each_value = /*events*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(div0, "class", "row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-xl-4 text-center");
    			add_location(div0, file$2, 19, 2, 463);
    			attr_dev(div1, "class", "container");
    			add_location(div1, file$2, 18, 0, 401);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*currentEvent, events*/ 3) {
    				each_value = /*events*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div0, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div1_transition) div1_transition = create_bidirectional_transition(div1, fade, { duration: 250 }, true);
    				div1_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div1_transition) div1_transition = create_bidirectional_transition(div1, fade, { duration: 250 }, false);
    			div1_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_each(each_blocks, detaching);
    			if (detaching && div1_transition) div1_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Dashboard", slots, []);
    	let { currentEvent } = $$props;
    	const events = ["333", "222", "444", "minx", "3bld", "pyram"];
    	const writable_props = ["currentEvent"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Dashboard> was created with unknown prop '${key}'`);
    	});

    	const click_handler = e => $$invalidate(0, currentEvent = e);

    	$$self.$$set = $$props => {
    		if ("currentEvent" in $$props) $$invalidate(0, currentEvent = $$props.currentEvent);
    	};

    	$$self.$capture_state = () => ({ fade, currentEvent, events });

    	$$self.$inject_state = $$props => {
    		if ("currentEvent" in $$props) $$invalidate(0, currentEvent = $$props.currentEvent);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [currentEvent, events, click_handler];
    }

    class Dashboard extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { currentEvent: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Dashboard",
    			options,
    			id: create_fragment$2.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*currentEvent*/ ctx[0] === undefined && !("currentEvent" in props)) {
    			console.warn("<Dashboard> was created without expected prop 'currentEvent'");
    		}
    	}

    	get currentEvent() {
    		throw new Error("<Dashboard>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set currentEvent(value) {
    		throw new Error("<Dashboard>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function createCommonjsModule(fn, basedir, module) {
    	return module = {
    	  path: basedir,
    	  exports: {},
    	  require: function (path, base) {
          return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
        }
    	}, fn(module, module.exports), module.exports;
    }

    function commonjsRequire () {
    	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
    }

    var dayjs_min = createCommonjsModule(function (module, exports) {
    !function(t,e){module.exports=e();}(commonjsGlobal,function(){var t="millisecond",e="second",n="minute",r="hour",i="day",s="week",u="month",a="quarter",o="year",f="date",h=/^(\d{4})[-/]?(\d{1,2})?[-/]?(\d{0,2})[^0-9]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?.?(\d+)?$/,c=/\[([^\]]+)]|Y{2,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g,d={name:"en",weekdays:"Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"),months:"January_February_March_April_May_June_July_August_September_October_November_December".split("_")},$=function(t,e,n){var r=String(t);return !r||r.length>=e?t:""+Array(e+1-r.length).join(n)+t},l={s:$,z:function(t){var e=-t.utcOffset(),n=Math.abs(e),r=Math.floor(n/60),i=n%60;return (e<=0?"+":"-")+$(r,2,"0")+":"+$(i,2,"0")},m:function t(e,n){if(e.date()<n.date())return -t(n,e);var r=12*(n.year()-e.year())+(n.month()-e.month()),i=e.clone().add(r,u),s=n-i<0,a=e.clone().add(r+(s?-1:1),u);return +(-(r+(n-i)/(s?i-a:a-i))||0)},a:function(t){return t<0?Math.ceil(t)||0:Math.floor(t)},p:function(h){return {M:u,y:o,w:s,d:i,D:f,h:r,m:n,s:e,ms:t,Q:a}[h]||String(h||"").toLowerCase().replace(/s$/,"")},u:function(t){return void 0===t}},y="en",M={};M[y]=d;var m=function(t){return t instanceof S},D=function(t,e,n){var r;if(!t)return y;if("string"==typeof t)M[t]&&(r=t),e&&(M[t]=e,r=t);else {var i=t.name;M[i]=t,r=i;}return !n&&r&&(y=r),r||!n&&y},v=function(t,e){if(m(t))return t.clone();var n="object"==typeof e?e:{};return n.date=t,n.args=arguments,new S(n)},g=l;g.l=D,g.i=m,g.w=function(t,e){return v(t,{locale:e.$L,utc:e.$u,x:e.$x,$offset:e.$offset})};var S=function(){function d(t){this.$L=D(t.locale,null,!0),this.parse(t);}var $=d.prototype;return $.parse=function(t){this.$d=function(t){var e=t.date,n=t.utc;if(null===e)return new Date(NaN);if(g.u(e))return new Date;if(e instanceof Date)return new Date(e);if("string"==typeof e&&!/Z$/i.test(e)){var r=e.match(h);if(r){var i=r[2]-1||0,s=(r[7]||"0").substring(0,3);return n?new Date(Date.UTC(r[1],i,r[3]||1,r[4]||0,r[5]||0,r[6]||0,s)):new Date(r[1],i,r[3]||1,r[4]||0,r[5]||0,r[6]||0,s)}}return new Date(e)}(t),this.$x=t.x||{},this.init();},$.init=function(){var t=this.$d;this.$y=t.getFullYear(),this.$M=t.getMonth(),this.$D=t.getDate(),this.$W=t.getDay(),this.$H=t.getHours(),this.$m=t.getMinutes(),this.$s=t.getSeconds(),this.$ms=t.getMilliseconds();},$.$utils=function(){return g},$.isValid=function(){return !("Invalid Date"===this.$d.toString())},$.isSame=function(t,e){var n=v(t);return this.startOf(e)<=n&&n<=this.endOf(e)},$.isAfter=function(t,e){return v(t)<this.startOf(e)},$.isBefore=function(t,e){return this.endOf(e)<v(t)},$.$g=function(t,e,n){return g.u(t)?this[e]:this.set(n,t)},$.unix=function(){return Math.floor(this.valueOf()/1e3)},$.valueOf=function(){return this.$d.getTime()},$.startOf=function(t,a){var h=this,c=!!g.u(a)||a,d=g.p(t),$=function(t,e){var n=g.w(h.$u?Date.UTC(h.$y,e,t):new Date(h.$y,e,t),h);return c?n:n.endOf(i)},l=function(t,e){return g.w(h.toDate()[t].apply(h.toDate("s"),(c?[0,0,0,0]:[23,59,59,999]).slice(e)),h)},y=this.$W,M=this.$M,m=this.$D,D="set"+(this.$u?"UTC":"");switch(d){case o:return c?$(1,0):$(31,11);case u:return c?$(1,M):$(0,M+1);case s:var v=this.$locale().weekStart||0,S=(y<v?y+7:y)-v;return $(c?m-S:m+(6-S),M);case i:case f:return l(D+"Hours",0);case r:return l(D+"Minutes",1);case n:return l(D+"Seconds",2);case e:return l(D+"Milliseconds",3);default:return this.clone()}},$.endOf=function(t){return this.startOf(t,!1)},$.$set=function(s,a){var h,c=g.p(s),d="set"+(this.$u?"UTC":""),$=(h={},h[i]=d+"Date",h[f]=d+"Date",h[u]=d+"Month",h[o]=d+"FullYear",h[r]=d+"Hours",h[n]=d+"Minutes",h[e]=d+"Seconds",h[t]=d+"Milliseconds",h)[c],l=c===i?this.$D+(a-this.$W):a;if(c===u||c===o){var y=this.clone().set(f,1);y.$d[$](l),y.init(),this.$d=y.set(f,Math.min(this.$D,y.daysInMonth())).$d;}else $&&this.$d[$](l);return this.init(),this},$.set=function(t,e){return this.clone().$set(t,e)},$.get=function(t){return this[g.p(t)]()},$.add=function(t,a){var f,h=this;t=Number(t);var c=g.p(a),d=function(e){var n=v(h);return g.w(n.date(n.date()+Math.round(e*t)),h)};if(c===u)return this.set(u,this.$M+t);if(c===o)return this.set(o,this.$y+t);if(c===i)return d(1);if(c===s)return d(7);var $=(f={},f[n]=6e4,f[r]=36e5,f[e]=1e3,f)[c]||1,l=this.$d.getTime()+t*$;return g.w(l,this)},$.subtract=function(t,e){return this.add(-1*t,e)},$.format=function(t){var e=this;if(!this.isValid())return "Invalid Date";var n=t||"YYYY-MM-DDTHH:mm:ssZ",r=g.z(this),i=this.$locale(),s=this.$H,u=this.$m,a=this.$M,o=i.weekdays,f=i.months,h=function(t,r,i,s){return t&&(t[r]||t(e,n))||i[r].substr(0,s)},d=function(t){return g.s(s%12||12,t,"0")},$=i.meridiem||function(t,e,n){var r=t<12?"AM":"PM";return n?r.toLowerCase():r},l={YY:String(this.$y).slice(-2),YYYY:this.$y,M:a+1,MM:g.s(a+1,2,"0"),MMM:h(i.monthsShort,a,f,3),MMMM:h(f,a),D:this.$D,DD:g.s(this.$D,2,"0"),d:String(this.$W),dd:h(i.weekdaysMin,this.$W,o,2),ddd:h(i.weekdaysShort,this.$W,o,3),dddd:o[this.$W],H:String(s),HH:g.s(s,2,"0"),h:d(1),hh:d(2),a:$(s,u,!0),A:$(s,u,!1),m:String(u),mm:g.s(u,2,"0"),s:String(this.$s),ss:g.s(this.$s,2,"0"),SSS:g.s(this.$ms,3,"0"),Z:r};return n.replace(c,function(t,e){return e||l[t]||r.replace(":","")})},$.utcOffset=function(){return 15*-Math.round(this.$d.getTimezoneOffset()/15)},$.diff=function(t,f,h){var c,d=g.p(f),$=v(t),l=6e4*($.utcOffset()-this.utcOffset()),y=this-$,M=g.m(this,$);return M=(c={},c[o]=M/12,c[u]=M,c[a]=M/3,c[s]=(y-l)/6048e5,c[i]=(y-l)/864e5,c[r]=y/36e5,c[n]=y/6e4,c[e]=y/1e3,c)[d]||y,h?M:g.a(M)},$.daysInMonth=function(){return this.endOf(u).$D},$.$locale=function(){return M[this.$L]},$.locale=function(t,e){if(!t)return this.$L;var n=this.clone(),r=D(t,e,!0);return r&&(n.$L=r),n},$.clone=function(){return g.w(this.$d,this)},$.toDate=function(){return new Date(this.valueOf())},$.toJSON=function(){return this.isValid()?this.toISOString():null},$.toISOString=function(){return this.$d.toISOString()},$.toString=function(){return this.$d.toUTCString()},d}(),p=S.prototype;return v.prototype=p,[["$ms",t],["$s",e],["$m",n],["$H",r],["$W",i],["$M",u],["$y",o],["$D",f]].forEach(function(t){p[t[1]]=function(e){return this.$g(e,t[0],t[1])};}),v.extend=function(t,e){return t(e,S,v),v},v.locale=D,v.isDayjs=m,v.unix=function(t){return v(1e3*t)},v.en=M[y],v.Ls=M,v.p={},v});
    });

    /* src/Components/Timer.svelte generated by Svelte v3.29.7 */
    const file$3 = "src/Components/Timer.svelte";

    function create_fragment$3(ctx) {
    	let h1;
    	let t;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			t = text(/*timerText*/ ctx[2]);
    			attr_dev(h1, "class", "display-1 text-center svelte-8ujohx");
    			toggle_class(h1, "green", /*green*/ ctx[0]);
    			toggle_class(h1, "red", /*red*/ ctx[1]);
    			add_location(h1, file$3, 87, 0, 1575);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			append_dev(h1, t);

    			if (!mounted) {
    				dispose = [
    					listen_dev(window, "keydown", /*down*/ ctx[3], false, false, false),
    					listen_dev(window, "keyup", /*up*/ ctx[4], false, false, false),
    					listen_dev(h1, "touchstart", /*touchstart_handler*/ ctx[5], { passive: true }, false, false),
    					listen_dev(h1, "touchend", /*touchend_handler*/ ctx[6], { passive: true }, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*timerText*/ 4) set_data_dev(t, /*timerText*/ ctx[2]);

    			if (dirty & /*green*/ 1) {
    				toggle_class(h1, "green", /*green*/ ctx[0]);
    			}

    			if (dirty & /*red*/ 2) {
    				toggle_class(h1, "red", /*red*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Timer", slots, []);
    	let startTime;
    	let timeout;
    	let allowed = true;
    	let green = false;
    	let red = false;
    	let running = false;
    	let timerColor = "black";
    	let timerText = "Ready";
    	let waiting = false;

    	const msToTime = t => {
    		const time = Number(t);
    		const min = Math.floor(time / (60 * 1000));
    		let s = ((time - min * 60 * 1000) / 1000).toFixed(2);

    		if (min > 0 && s.length === 4) {
    			s = "0" + s;
    		}

    		return `${min ? min + ":" : ""}${s}`;
    	};

    	const displayTime = () => $$invalidate(2, timerText = msToTime(dayjs_min().diff(startTime)));

    	const startTimer = () => {
    		running = true;
    		timeout = setInterval(displayTime, 10);
    		startTime = dayjs_min();
    		$$invalidate(0, green = false);
    	};

    	const stopTimer = () => {
    		running = false;
    		waiting = true;
    		$$invalidate(1, red = true);
    		clearTimeout(timeout);
    		$$invalidate(2, timerText = msToTime(dayjs_min().diff(startTime)));
    	};

    	const timerSetReady = () => {
    		waiting = false;
    		$$invalidate(2, timerText = "0.00");
    		$$invalidate(0, green = true);
    	};

    	const timerAfterStop = () => {
    		$$invalidate(1, red = false);
    	};

    	const down = event => {
    		if (!allowed) {
    			return;
    		}

    		if (running) {
    			stopTimer();
    		} else if (event.code === "Space") {
    			timerSetReady();
    		}

    		allowed = false;
    	};

    	const up = event => {
    		if (!running && !waiting && event.code === "Space") {
    			startTimer();
    		} else {
    			timerAfterStop();
    		}

    		allowed = true;
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Timer> was created with unknown prop '${key}'`);
    	});

    	const touchstart_handler = () => down({ code: "Space" });
    	const touchend_handler = () => up({ code: "Space" });

    	$$self.$capture_state = () => ({
    		dayjs: dayjs_min,
    		startTime,
    		timeout,
    		allowed,
    		green,
    		red,
    		running,
    		timerColor,
    		timerText,
    		waiting,
    		msToTime,
    		displayTime,
    		startTimer,
    		stopTimer,
    		timerSetReady,
    		timerAfterStop,
    		down,
    		up
    	});

    	$$self.$inject_state = $$props => {
    		if ("startTime" in $$props) startTime = $$props.startTime;
    		if ("timeout" in $$props) timeout = $$props.timeout;
    		if ("allowed" in $$props) allowed = $$props.allowed;
    		if ("green" in $$props) $$invalidate(0, green = $$props.green);
    		if ("red" in $$props) $$invalidate(1, red = $$props.red);
    		if ("running" in $$props) running = $$props.running;
    		if ("timerColor" in $$props) timerColor = $$props.timerColor;
    		if ("timerText" in $$props) $$invalidate(2, timerText = $$props.timerText);
    		if ("waiting" in $$props) waiting = $$props.waiting;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [green, red, timerText, down, up, touchstart_handler, touchend_handler];
    }

    class Timer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Timer",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src/Components/Solve.svelte generated by Svelte v3.29.7 */
    const file$4 = "src/Components/Solve.svelte";

    function create_fragment$4(ctx) {
    	let div6;
    	let div5;
    	let main;
    	let div2;
    	let h1;
    	let t1;
    	let div1;
    	let div0;
    	let button0;
    	let t3;
    	let button1;
    	let t5;
    	let button2;
    	let svg0;
    	let rect;
    	let line0;
    	let line1;
    	let line2;
    	let t6;
    	let t7;
    	let timer;
    	let t8;
    	let h2;
    	let t10;
    	let div3;
    	let table;
    	let thead;
    	let tr0;
    	let th0;
    	let t12;
    	let th1;
    	let t14;
    	let th2;
    	let t16;
    	let th3;
    	let t18;
    	let th4;
    	let t20;
    	let tbody;
    	let tr1;
    	let td0;
    	let t22;
    	let td1;
    	let t24;
    	let td2;
    	let t26;
    	let td3;
    	let t28;
    	let td4;
    	let t30;
    	let tr2;
    	let td5;
    	let t32;
    	let td6;
    	let t34;
    	let td7;
    	let t36;
    	let td8;
    	let t38;
    	let td9;
    	let t40;
    	let tr3;
    	let td10;
    	let t42;
    	let td11;
    	let t44;
    	let td12;
    	let t46;
    	let td13;
    	let t48;
    	let td14;
    	let t50;
    	let tr4;
    	let td15;
    	let t52;
    	let td16;
    	let t54;
    	let td17;
    	let t56;
    	let td18;
    	let t58;
    	let td19;
    	let t60;
    	let tr5;
    	let td20;
    	let t62;
    	let td21;
    	let t64;
    	let td22;
    	let t66;
    	let td23;
    	let t68;
    	let td24;
    	let t70;
    	let tr6;
    	let td25;
    	let t72;
    	let td26;
    	let t74;
    	let td27;
    	let t76;
    	let td28;
    	let t78;
    	let td29;
    	let t80;
    	let tr7;
    	let td30;
    	let t82;
    	let td31;
    	let t84;
    	let td32;
    	let t86;
    	let td33;
    	let t88;
    	let td34;
    	let t90;
    	let tr8;
    	let td35;
    	let t92;
    	let td36;
    	let t94;
    	let td37;
    	let t96;
    	let td38;
    	let t98;
    	let td39;
    	let t100;
    	let tr9;
    	let td40;
    	let t102;
    	let td41;
    	let t104;
    	let td42;
    	let t106;
    	let td43;
    	let t108;
    	let td44;
    	let t110;
    	let tr10;
    	let td45;
    	let t112;
    	let td46;
    	let t114;
    	let td47;
    	let t116;
    	let td48;
    	let t118;
    	let td49;
    	let t120;
    	let tr11;
    	let td50;
    	let t122;
    	let td51;
    	let t124;
    	let td52;
    	let t126;
    	let td53;
    	let t128;
    	let td54;
    	let t130;
    	let tr12;
    	let td55;
    	let t132;
    	let td56;
    	let t134;
    	let td57;
    	let t136;
    	let td58;
    	let t138;
    	let td59;
    	let t140;
    	let tr13;
    	let td60;
    	let t142;
    	let td61;
    	let t144;
    	let td62;
    	let t146;
    	let td63;
    	let t148;
    	let td64;
    	let t150;
    	let tr14;
    	let td65;
    	let t152;
    	let td66;
    	let t154;
    	let td67;
    	let t156;
    	let td68;
    	let t158;
    	let td69;
    	let t160;
    	let tr15;
    	let td70;
    	let t162;
    	let td71;
    	let t164;
    	let td72;
    	let t166;
    	let td73;
    	let t168;
    	let td74;
    	let t170;
    	let tr16;
    	let td75;
    	let t172;
    	let td76;
    	let t174;
    	let td77;
    	let t176;
    	let td78;
    	let t178;
    	let td79;
    	let t180;
    	let nav;
    	let div4;
    	let ul0;
    	let li0;
    	let a0;
    	let svg1;
    	let path0;
    	let polyline0;
    	let t181;
    	let t182;
    	let li1;
    	let a1;
    	let svg2;
    	let path1;
    	let polyline1;
    	let t183;
    	let t184;
    	let li2;
    	let a2;
    	let svg3;
    	let circle0;
    	let circle1;
    	let path2;
    	let t185;
    	let t186;
    	let li3;
    	let a3;
    	let svg4;
    	let path3;
    	let circle2;
    	let path4;
    	let path5;
    	let t187;
    	let t188;
    	let li4;
    	let a4;
    	let svg5;
    	let line3;
    	let line4;
    	let line5;
    	let t189;
    	let t190;
    	let li5;
    	let a5;
    	let svg6;
    	let polygon;
    	let polyline2;
    	let polyline3;
    	let t191;
    	let t192;
    	let h6;
    	let span;
    	let t194;
    	let a6;
    	let svg7;
    	let circle3;
    	let line6;
    	let line7;
    	let t195;
    	let ul1;
    	let li6;
    	let a7;
    	let svg8;
    	let path6;
    	let polyline4;
    	let line8;
    	let line9;
    	let polyline5;
    	let t196;
    	let t197;
    	let li7;
    	let a8;
    	let svg9;
    	let path7;
    	let polyline6;
    	let line10;
    	let line11;
    	let polyline7;
    	let t198;
    	let t199;
    	let li8;
    	let a9;
    	let svg10;
    	let path8;
    	let polyline8;
    	let line12;
    	let line13;
    	let polyline9;
    	let t200;
    	let t201;
    	let li9;
    	let a10;
    	let svg11;
    	let path9;
    	let polyline10;
    	let line14;
    	let line15;
    	let polyline11;
    	let t202;
    	let current;
    	timer = new Timer({ $$inline: true });

    	const block = {
    		c: function create() {
    			div6 = element("div");
    			div5 = element("div");
    			main = element("main");
    			div2 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Dashboard";
    			t1 = space();
    			div1 = element("div");
    			div0 = element("div");
    			button0 = element("button");
    			button0.textContent = "Share";
    			t3 = space();
    			button1 = element("button");
    			button1.textContent = "Export";
    			t5 = space();
    			button2 = element("button");
    			svg0 = svg_element("svg");
    			rect = svg_element("rect");
    			line0 = svg_element("line");
    			line1 = svg_element("line");
    			line2 = svg_element("line");
    			t6 = text("\n            This week");
    			t7 = space();
    			create_component(timer.$$.fragment);
    			t8 = space();
    			h2 = element("h2");
    			h2.textContent = "Section title";
    			t10 = space();
    			div3 = element("div");
    			table = element("table");
    			thead = element("thead");
    			tr0 = element("tr");
    			th0 = element("th");
    			th0.textContent = "#";
    			t12 = space();
    			th1 = element("th");
    			th1.textContent = "Header";
    			t14 = space();
    			th2 = element("th");
    			th2.textContent = "Header";
    			t16 = space();
    			th3 = element("th");
    			th3.textContent = "Header";
    			t18 = space();
    			th4 = element("th");
    			th4.textContent = "Header";
    			t20 = space();
    			tbody = element("tbody");
    			tr1 = element("tr");
    			td0 = element("td");
    			td0.textContent = "1,001";
    			t22 = space();
    			td1 = element("td");
    			td1.textContent = "Lorem";
    			t24 = space();
    			td2 = element("td");
    			td2.textContent = "ipsum";
    			t26 = space();
    			td3 = element("td");
    			td3.textContent = "dolor";
    			t28 = space();
    			td4 = element("td");
    			td4.textContent = "sit";
    			t30 = space();
    			tr2 = element("tr");
    			td5 = element("td");
    			td5.textContent = "1,002";
    			t32 = space();
    			td6 = element("td");
    			td6.textContent = "amet";
    			t34 = space();
    			td7 = element("td");
    			td7.textContent = "consectetur";
    			t36 = space();
    			td8 = element("td");
    			td8.textContent = "adipiscing";
    			t38 = space();
    			td9 = element("td");
    			td9.textContent = "elit";
    			t40 = space();
    			tr3 = element("tr");
    			td10 = element("td");
    			td10.textContent = "1,003";
    			t42 = space();
    			td11 = element("td");
    			td11.textContent = "Integer";
    			t44 = space();
    			td12 = element("td");
    			td12.textContent = "nec";
    			t46 = space();
    			td13 = element("td");
    			td13.textContent = "odio";
    			t48 = space();
    			td14 = element("td");
    			td14.textContent = "Praesent";
    			t50 = space();
    			tr4 = element("tr");
    			td15 = element("td");
    			td15.textContent = "1,003";
    			t52 = space();
    			td16 = element("td");
    			td16.textContent = "libero";
    			t54 = space();
    			td17 = element("td");
    			td17.textContent = "Sed";
    			t56 = space();
    			td18 = element("td");
    			td18.textContent = "cursus";
    			t58 = space();
    			td19 = element("td");
    			td19.textContent = "ante";
    			t60 = space();
    			tr5 = element("tr");
    			td20 = element("td");
    			td20.textContent = "1,004";
    			t62 = space();
    			td21 = element("td");
    			td21.textContent = "dapibus";
    			t64 = space();
    			td22 = element("td");
    			td22.textContent = "diam";
    			t66 = space();
    			td23 = element("td");
    			td23.textContent = "Sed";
    			t68 = space();
    			td24 = element("td");
    			td24.textContent = "nisi";
    			t70 = space();
    			tr6 = element("tr");
    			td25 = element("td");
    			td25.textContent = "1,005";
    			t72 = space();
    			td26 = element("td");
    			td26.textContent = "Nulla";
    			t74 = space();
    			td27 = element("td");
    			td27.textContent = "quis";
    			t76 = space();
    			td28 = element("td");
    			td28.textContent = "sem";
    			t78 = space();
    			td29 = element("td");
    			td29.textContent = "at";
    			t80 = space();
    			tr7 = element("tr");
    			td30 = element("td");
    			td30.textContent = "1,006";
    			t82 = space();
    			td31 = element("td");
    			td31.textContent = "nibh";
    			t84 = space();
    			td32 = element("td");
    			td32.textContent = "elementum";
    			t86 = space();
    			td33 = element("td");
    			td33.textContent = "imperdiet";
    			t88 = space();
    			td34 = element("td");
    			td34.textContent = "Duis";
    			t90 = space();
    			tr8 = element("tr");
    			td35 = element("td");
    			td35.textContent = "1,007";
    			t92 = space();
    			td36 = element("td");
    			td36.textContent = "sagittis";
    			t94 = space();
    			td37 = element("td");
    			td37.textContent = "ipsum";
    			t96 = space();
    			td38 = element("td");
    			td38.textContent = "Praesent";
    			t98 = space();
    			td39 = element("td");
    			td39.textContent = "mauris";
    			t100 = space();
    			tr9 = element("tr");
    			td40 = element("td");
    			td40.textContent = "1,008";
    			t102 = space();
    			td41 = element("td");
    			td41.textContent = "Fusce";
    			t104 = space();
    			td42 = element("td");
    			td42.textContent = "nec";
    			t106 = space();
    			td43 = element("td");
    			td43.textContent = "tellus";
    			t108 = space();
    			td44 = element("td");
    			td44.textContent = "sed";
    			t110 = space();
    			tr10 = element("tr");
    			td45 = element("td");
    			td45.textContent = "1,009";
    			t112 = space();
    			td46 = element("td");
    			td46.textContent = "augue";
    			t114 = space();
    			td47 = element("td");
    			td47.textContent = "semper";
    			t116 = space();
    			td48 = element("td");
    			td48.textContent = "porta";
    			t118 = space();
    			td49 = element("td");
    			td49.textContent = "Mauris";
    			t120 = space();
    			tr11 = element("tr");
    			td50 = element("td");
    			td50.textContent = "1,010";
    			t122 = space();
    			td51 = element("td");
    			td51.textContent = "massa";
    			t124 = space();
    			td52 = element("td");
    			td52.textContent = "Vestibulum";
    			t126 = space();
    			td53 = element("td");
    			td53.textContent = "lacinia";
    			t128 = space();
    			td54 = element("td");
    			td54.textContent = "arcu";
    			t130 = space();
    			tr12 = element("tr");
    			td55 = element("td");
    			td55.textContent = "1,011";
    			t132 = space();
    			td56 = element("td");
    			td56.textContent = "eget";
    			t134 = space();
    			td57 = element("td");
    			td57.textContent = "nulla";
    			t136 = space();
    			td58 = element("td");
    			td58.textContent = "Class";
    			t138 = space();
    			td59 = element("td");
    			td59.textContent = "aptent";
    			t140 = space();
    			tr13 = element("tr");
    			td60 = element("td");
    			td60.textContent = "1,012";
    			t142 = space();
    			td61 = element("td");
    			td61.textContent = "taciti";
    			t144 = space();
    			td62 = element("td");
    			td62.textContent = "sociosqu";
    			t146 = space();
    			td63 = element("td");
    			td63.textContent = "ad";
    			t148 = space();
    			td64 = element("td");
    			td64.textContent = "litora";
    			t150 = space();
    			tr14 = element("tr");
    			td65 = element("td");
    			td65.textContent = "1,013";
    			t152 = space();
    			td66 = element("td");
    			td66.textContent = "torquent";
    			t154 = space();
    			td67 = element("td");
    			td67.textContent = "per";
    			t156 = space();
    			td68 = element("td");
    			td68.textContent = "conubia";
    			t158 = space();
    			td69 = element("td");
    			td69.textContent = "nostra";
    			t160 = space();
    			tr15 = element("tr");
    			td70 = element("td");
    			td70.textContent = "1,014";
    			t162 = space();
    			td71 = element("td");
    			td71.textContent = "per";
    			t164 = space();
    			td72 = element("td");
    			td72.textContent = "inceptos";
    			t166 = space();
    			td73 = element("td");
    			td73.textContent = "himenaeos";
    			t168 = space();
    			td74 = element("td");
    			td74.textContent = "Curabitur";
    			t170 = space();
    			tr16 = element("tr");
    			td75 = element("td");
    			td75.textContent = "1,015";
    			t172 = space();
    			td76 = element("td");
    			td76.textContent = "sodales";
    			t174 = space();
    			td77 = element("td");
    			td77.textContent = "ligula";
    			t176 = space();
    			td78 = element("td");
    			td78.textContent = "in";
    			t178 = space();
    			td79 = element("td");
    			td79.textContent = "libero";
    			t180 = space();
    			nav = element("nav");
    			div4 = element("div");
    			ul0 = element("ul");
    			li0 = element("li");
    			a0 = element("a");
    			svg1 = svg_element("svg");
    			path0 = svg_element("path");
    			polyline0 = svg_element("polyline");
    			t181 = text("\n              Dashboard");
    			t182 = space();
    			li1 = element("li");
    			a1 = element("a");
    			svg2 = svg_element("svg");
    			path1 = svg_element("path");
    			polyline1 = svg_element("polyline");
    			t183 = text("\n              Orders");
    			t184 = space();
    			li2 = element("li");
    			a2 = element("a");
    			svg3 = svg_element("svg");
    			circle0 = svg_element("circle");
    			circle1 = svg_element("circle");
    			path2 = svg_element("path");
    			t185 = text("\n              Products");
    			t186 = space();
    			li3 = element("li");
    			a3 = element("a");
    			svg4 = svg_element("svg");
    			path3 = svg_element("path");
    			circle2 = svg_element("circle");
    			path4 = svg_element("path");
    			path5 = svg_element("path");
    			t187 = text("\n              Customers");
    			t188 = space();
    			li4 = element("li");
    			a4 = element("a");
    			svg5 = svg_element("svg");
    			line3 = svg_element("line");
    			line4 = svg_element("line");
    			line5 = svg_element("line");
    			t189 = text("\n              Reports");
    			t190 = space();
    			li5 = element("li");
    			a5 = element("a");
    			svg6 = svg_element("svg");
    			polygon = svg_element("polygon");
    			polyline2 = svg_element("polyline");
    			polyline3 = svg_element("polyline");
    			t191 = text("\n              Integrations");
    			t192 = space();
    			h6 = element("h6");
    			span = element("span");
    			span.textContent = "Saved reports";
    			t194 = space();
    			a6 = element("a");
    			svg7 = svg_element("svg");
    			circle3 = svg_element("circle");
    			line6 = svg_element("line");
    			line7 = svg_element("line");
    			t195 = space();
    			ul1 = element("ul");
    			li6 = element("li");
    			a7 = element("a");
    			svg8 = svg_element("svg");
    			path6 = svg_element("path");
    			polyline4 = svg_element("polyline");
    			line8 = svg_element("line");
    			line9 = svg_element("line");
    			polyline5 = svg_element("polyline");
    			t196 = text("\n              Current month");
    			t197 = space();
    			li7 = element("li");
    			a8 = element("a");
    			svg9 = svg_element("svg");
    			path7 = svg_element("path");
    			polyline6 = svg_element("polyline");
    			line10 = svg_element("line");
    			line11 = svg_element("line");
    			polyline7 = svg_element("polyline");
    			t198 = text("\n              Last quarter");
    			t199 = space();
    			li8 = element("li");
    			a9 = element("a");
    			svg10 = svg_element("svg");
    			path8 = svg_element("path");
    			polyline8 = svg_element("polyline");
    			line12 = svg_element("line");
    			line13 = svg_element("line");
    			polyline9 = svg_element("polyline");
    			t200 = text("\n              Social engagement");
    			t201 = space();
    			li9 = element("li");
    			a10 = element("a");
    			svg11 = svg_element("svg");
    			path9 = svg_element("path");
    			polyline10 = svg_element("polyline");
    			line14 = svg_element("line");
    			line15 = svg_element("line");
    			polyline11 = svg_element("polyline");
    			t202 = text("\n              Year-end sale");
    			attr_dev(h1, "class", "h2");
    			add_location(h1, file$4, 11, 8, 333);
    			attr_dev(button0, "type", "button");
    			attr_dev(button0, "class", "btn btn-sm btn-outline-secondary");
    			add_location(button0, file$4, 14, 12, 461);
    			attr_dev(button1, "type", "button");
    			attr_dev(button1, "class", "btn btn-sm btn-outline-secondary");
    			add_location(button1, file$4, 17, 12, 579);
    			attr_dev(div0, "class", "btn-group mr-2");
    			add_location(div0, file$4, 13, 10, 420);
    			attr_dev(rect, "x", "3");
    			attr_dev(rect, "y", "4");
    			attr_dev(rect, "width", "18");
    			attr_dev(rect, "height", "18");
    			attr_dev(rect, "rx", "2");
    			attr_dev(rect, "ry", "2");
    			add_location(rect, file$4, 34, 47, 1183);
    			attr_dev(line0, "x1", "16");
    			attr_dev(line0, "y1", "2");
    			attr_dev(line0, "x2", "16");
    			attr_dev(line0, "y2", "6");
    			add_location(line0, file$4, 41, 14, 1351);
    			attr_dev(line1, "x1", "8");
    			attr_dev(line1, "y1", "2");
    			attr_dev(line1, "x2", "8");
    			attr_dev(line1, "y2", "6");
    			add_location(line1, file$4, 42, 14, 1404);
    			attr_dev(line2, "x1", "3");
    			attr_dev(line2, "y1", "10");
    			attr_dev(line2, "x2", "21");
    			attr_dev(line2, "y2", "10");
    			add_location(line2, file$4, 43, 14, 1455);
    			attr_dev(svg0, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg0, "width", "24");
    			attr_dev(svg0, "height", "24");
    			attr_dev(svg0, "viewBox", "0 0 24 24");
    			attr_dev(svg0, "fill", "none");
    			attr_dev(svg0, "stroke", "currentColor");
    			attr_dev(svg0, "stroke-width", "2");
    			attr_dev(svg0, "stroke-linecap", "round");
    			attr_dev(svg0, "stroke-linejoin", "round");
    			attr_dev(svg0, "class", "feather feather-calendar");
    			add_location(svg0, file$4, 24, 12, 829);
    			attr_dev(button2, "type", "button");
    			attr_dev(button2, "class", "btn btn-sm btn-outline-secondary dropdown-toggle");
    			add_location(button2, file$4, 21, 10, 713);
    			attr_dev(div1, "class", "btn-toolbar mb-2 mb-md-0");
    			add_location(div1, file$4, 12, 8, 371);
    			attr_dev(div2, "class", "d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom");
    			add_location(div2, file$4, 9, 6, 199);
    			add_location(h2, file$4, 51, 6, 1595);
    			add_location(th0, file$4, 56, 14, 1757);
    			add_location(th1, file$4, 57, 14, 1782);
    			add_location(th2, file$4, 58, 14, 1812);
    			add_location(th3, file$4, 59, 14, 1842);
    			add_location(th4, file$4, 60, 14, 1872);
    			add_location(tr0, file$4, 55, 12, 1738);
    			add_location(thead, file$4, 54, 10, 1718);
    			add_location(td0, file$4, 65, 14, 1974);
    			add_location(td1, file$4, 66, 14, 2003);
    			add_location(td2, file$4, 67, 14, 2032);
    			add_location(td3, file$4, 68, 14, 2061);
    			add_location(td4, file$4, 69, 14, 2090);
    			add_location(tr1, file$4, 64, 12, 1955);
    			add_location(td5, file$4, 72, 14, 2152);
    			add_location(td6, file$4, 73, 14, 2181);
    			add_location(td7, file$4, 74, 14, 2209);
    			add_location(td8, file$4, 75, 14, 2244);
    			add_location(td9, file$4, 76, 14, 2278);
    			add_location(tr2, file$4, 71, 12, 2133);
    			add_location(td10, file$4, 79, 14, 2341);
    			add_location(td11, file$4, 80, 14, 2370);
    			add_location(td12, file$4, 81, 14, 2401);
    			add_location(td13, file$4, 82, 14, 2428);
    			add_location(td14, file$4, 83, 14, 2456);
    			add_location(tr3, file$4, 78, 12, 2322);
    			add_location(td15, file$4, 86, 14, 2523);
    			add_location(td16, file$4, 87, 14, 2552);
    			add_location(td17, file$4, 88, 14, 2582);
    			add_location(td18, file$4, 89, 14, 2609);
    			add_location(td19, file$4, 90, 14, 2639);
    			add_location(tr4, file$4, 85, 12, 2504);
    			add_location(td20, file$4, 93, 14, 2702);
    			add_location(td21, file$4, 94, 14, 2731);
    			add_location(td22, file$4, 95, 14, 2762);
    			add_location(td23, file$4, 96, 14, 2790);
    			add_location(td24, file$4, 97, 14, 2817);
    			add_location(tr5, file$4, 92, 12, 2683);
    			add_location(td25, file$4, 100, 14, 2880);
    			add_location(td26, file$4, 101, 14, 2909);
    			add_location(td27, file$4, 102, 14, 2938);
    			add_location(td28, file$4, 103, 14, 2966);
    			add_location(td29, file$4, 104, 14, 2993);
    			add_location(tr6, file$4, 99, 12, 2861);
    			add_location(td30, file$4, 107, 14, 3054);
    			add_location(td31, file$4, 108, 14, 3083);
    			add_location(td32, file$4, 109, 14, 3111);
    			add_location(td33, file$4, 110, 14, 3144);
    			add_location(td34, file$4, 111, 14, 3177);
    			add_location(tr7, file$4, 106, 12, 3035);
    			add_location(td35, file$4, 114, 14, 3240);
    			add_location(td36, file$4, 115, 14, 3269);
    			add_location(td37, file$4, 116, 14, 3301);
    			add_location(td38, file$4, 117, 14, 3330);
    			add_location(td39, file$4, 118, 14, 3362);
    			add_location(tr8, file$4, 113, 12, 3221);
    			add_location(td40, file$4, 121, 14, 3427);
    			add_location(td41, file$4, 122, 14, 3456);
    			add_location(td42, file$4, 123, 14, 3485);
    			add_location(td43, file$4, 124, 14, 3512);
    			add_location(td44, file$4, 125, 14, 3542);
    			add_location(tr9, file$4, 120, 12, 3408);
    			add_location(td45, file$4, 128, 14, 3604);
    			add_location(td46, file$4, 129, 14, 3633);
    			add_location(td47, file$4, 130, 14, 3662);
    			add_location(td48, file$4, 131, 14, 3692);
    			add_location(td49, file$4, 132, 14, 3721);
    			add_location(tr10, file$4, 127, 12, 3585);
    			add_location(td50, file$4, 135, 14, 3786);
    			add_location(td51, file$4, 136, 14, 3815);
    			add_location(td52, file$4, 137, 14, 3844);
    			add_location(td53, file$4, 138, 14, 3878);
    			add_location(td54, file$4, 139, 14, 3909);
    			add_location(tr11, file$4, 134, 12, 3767);
    			add_location(td55, file$4, 142, 14, 3972);
    			add_location(td56, file$4, 143, 14, 4001);
    			add_location(td57, file$4, 144, 14, 4029);
    			add_location(td58, file$4, 145, 14, 4058);
    			add_location(td59, file$4, 146, 14, 4087);
    			add_location(tr12, file$4, 141, 12, 3953);
    			add_location(td60, file$4, 149, 14, 4152);
    			add_location(td61, file$4, 150, 14, 4181);
    			add_location(td62, file$4, 151, 14, 4211);
    			add_location(td63, file$4, 152, 14, 4243);
    			add_location(td64, file$4, 153, 14, 4269);
    			add_location(tr13, file$4, 148, 12, 4133);
    			add_location(td65, file$4, 156, 14, 4334);
    			add_location(td66, file$4, 157, 14, 4363);
    			add_location(td67, file$4, 158, 14, 4395);
    			add_location(td68, file$4, 159, 14, 4422);
    			add_location(td69, file$4, 160, 14, 4453);
    			add_location(tr14, file$4, 155, 12, 4315);
    			add_location(td70, file$4, 163, 14, 4518);
    			add_location(td71, file$4, 164, 14, 4547);
    			add_location(td72, file$4, 165, 14, 4574);
    			add_location(td73, file$4, 166, 14, 4606);
    			add_location(td74, file$4, 167, 14, 4639);
    			add_location(tr15, file$4, 162, 12, 4499);
    			add_location(td75, file$4, 170, 14, 4707);
    			add_location(td76, file$4, 171, 14, 4736);
    			add_location(td77, file$4, 172, 14, 4767);
    			add_location(td78, file$4, 173, 14, 4797);
    			add_location(td79, file$4, 174, 14, 4823);
    			add_location(tr16, file$4, 169, 12, 4688);
    			add_location(tbody, file$4, 63, 10, 1935);
    			attr_dev(table, "class", "table table-striped table-sm");
    			add_location(table, file$4, 53, 8, 1663);
    			attr_dev(div3, "class", "table-responsive");
    			add_location(div3, file$4, 52, 6, 1624);
    			attr_dev(main, "class", "col-md-9 ml-sm-auto col-lg-10 px-md-4");
    			add_location(main, file$4, 8, 4, 140);
    			attr_dev(path0, "d", "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z");
    			add_location(path0, file$4, 197, 45, 5583);
    			attr_dev(polyline0, "points", "9 22 9 12 15 12 15 22");
    			add_location(polyline0, file$4, 199, 16, 5677);
    			attr_dev(svg1, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg1, "width", "24");
    			attr_dev(svg1, "height", "24");
    			attr_dev(svg1, "viewBox", "0 0 24 24");
    			attr_dev(svg1, "fill", "none");
    			attr_dev(svg1, "stroke", "currentColor");
    			attr_dev(svg1, "stroke-width", "2");
    			attr_dev(svg1, "stroke-linecap", "round");
    			attr_dev(svg1, "stroke-linejoin", "round");
    			attr_dev(svg1, "class", "feather feather-home");
    			add_location(svg1, file$4, 187, 14, 5213);
    			attr_dev(a0, "class", "nav-link active");
    			attr_dev(a0, "aria-current", "page");
    			attr_dev(a0, "href", "#");
    			add_location(a0, file$4, 186, 12, 5142);
    			attr_dev(li0, "class", "nav-item");
    			add_location(li0, file$4, 185, 10, 5108);
    			attr_dev(path1, "d", "M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z");
    			add_location(path1, file$4, 215, 45, 6242);
    			attr_dev(polyline1, "points", "13 2 13 9 20 9");
    			add_location(polyline1, file$4, 217, 16, 6348);
    			attr_dev(svg2, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg2, "width", "24");
    			attr_dev(svg2, "height", "24");
    			attr_dev(svg2, "viewBox", "0 0 24 24");
    			attr_dev(svg2, "fill", "none");
    			attr_dev(svg2, "stroke", "currentColor");
    			attr_dev(svg2, "stroke-width", "2");
    			attr_dev(svg2, "stroke-linecap", "round");
    			attr_dev(svg2, "stroke-linejoin", "round");
    			attr_dev(svg2, "class", "feather feather-file");
    			add_location(svg2, file$4, 205, 14, 5872);
    			attr_dev(a1, "class", "nav-link");
    			attr_dev(a1, "href", "#");
    			add_location(a1, file$4, 204, 12, 5828);
    			attr_dev(li1, "class", "nav-item");
    			add_location(li1, file$4, 203, 10, 5794);
    			attr_dev(circle0, "cx", "9");
    			attr_dev(circle0, "cy", "21");
    			attr_dev(circle0, "r", "1");
    			add_location(circle0, file$4, 233, 54, 6912);
    			attr_dev(circle1, "cx", "20");
    			attr_dev(circle1, "cy", "21");
    			attr_dev(circle1, "r", "1");
    			add_location(circle1, file$4, 237, 16, 7014);
    			attr_dev(path2, "d", "M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6");
    			add_location(path2, file$4, 238, 16, 7063);
    			attr_dev(svg3, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg3, "width", "24");
    			attr_dev(svg3, "height", "24");
    			attr_dev(svg3, "viewBox", "0 0 24 24");
    			attr_dev(svg3, "fill", "none");
    			attr_dev(svg3, "stroke", "currentColor");
    			attr_dev(svg3, "stroke-width", "2");
    			attr_dev(svg3, "stroke-linecap", "round");
    			attr_dev(svg3, "stroke-linejoin", "round");
    			attr_dev(svg3, "class", "feather feather-shopping-cart");
    			add_location(svg3, file$4, 223, 14, 6533);
    			attr_dev(a2, "class", "nav-link");
    			attr_dev(a2, "href", "#");
    			add_location(a2, file$4, 222, 12, 6489);
    			attr_dev(li2, "class", "nav-item");
    			add_location(li2, file$4, 221, 10, 6455);
    			attr_dev(path3, "d", "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2");
    			add_location(path3, file$4, 255, 46, 7679);
    			attr_dev(circle2, "cx", "9");
    			attr_dev(circle2, "cy", "7");
    			attr_dev(circle2, "r", "4");
    			add_location(circle2, file$4, 257, 16, 7768);
    			attr_dev(path4, "d", "M23 21v-2a4 4 0 0 0-3-3.87");
    			add_location(path4, file$4, 258, 16, 7815);
    			attr_dev(path5, "d", "M16 3.13a4 4 0 0 1 0 7.75");
    			add_location(path5, file$4, 259, 16, 7871);
    			attr_dev(svg4, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg4, "width", "24");
    			attr_dev(svg4, "height", "24");
    			attr_dev(svg4, "viewBox", "0 0 24 24");
    			attr_dev(svg4, "fill", "none");
    			attr_dev(svg4, "stroke", "currentColor");
    			attr_dev(svg4, "stroke-width", "2");
    			attr_dev(svg4, "stroke-linecap", "round");
    			attr_dev(svg4, "stroke-linejoin", "round");
    			attr_dev(svg4, "class", "feather feather-users");
    			add_location(svg4, file$4, 245, 14, 7308);
    			attr_dev(a3, "class", "nav-link");
    			attr_dev(a3, "href", "#");
    			add_location(a3, file$4, 244, 12, 7264);
    			attr_dev(li3, "class", "nav-item");
    			add_location(li3, file$4, 243, 10, 7230);
    			attr_dev(line3, "x1", "18");
    			attr_dev(line3, "y1", "20");
    			attr_dev(line3, "x2", "18");
    			attr_dev(line3, "y2", "10");
    			add_location(line3, file$4, 275, 52, 8438);
    			attr_dev(line4, "x1", "12");
    			attr_dev(line4, "y1", "20");
    			attr_dev(line4, "x2", "12");
    			attr_dev(line4, "y2", "4");
    			add_location(line4, file$4, 280, 16, 8567);
    			attr_dev(line5, "x1", "6");
    			attr_dev(line5, "y1", "20");
    			attr_dev(line5, "x2", "6");
    			attr_dev(line5, "y2", "14");
    			add_location(line5, file$4, 281, 16, 8623);
    			attr_dev(svg5, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg5, "width", "24");
    			attr_dev(svg5, "height", "24");
    			attr_dev(svg5, "viewBox", "0 0 24 24");
    			attr_dev(svg5, "fill", "none");
    			attr_dev(svg5, "stroke", "currentColor");
    			attr_dev(svg5, "stroke-width", "2");
    			attr_dev(svg5, "stroke-linecap", "round");
    			attr_dev(svg5, "stroke-linejoin", "round");
    			attr_dev(svg5, "class", "feather feather-bar-chart-2");
    			add_location(svg5, file$4, 265, 14, 8061);
    			attr_dev(a4, "class", "nav-link");
    			attr_dev(a4, "href", "#");
    			add_location(a4, file$4, 264, 12, 8017);
    			attr_dev(li4, "class", "nav-item");
    			add_location(li4, file$4, 263, 10, 7983);
    			attr_dev(polygon, "points", "12 2 2 7 12 12 22 7 12 2");
    			add_location(polygon, file$4, 297, 47, 9183);
    			attr_dev(polyline2, "points", "2 17 12 22 22 17");
    			add_location(polyline2, file$4, 299, 16, 9263);
    			attr_dev(polyline3, "points", "2 12 12 17 22 12");
    			add_location(polyline3, file$4, 300, 16, 9318);
    			attr_dev(svg6, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg6, "width", "24");
    			attr_dev(svg6, "height", "24");
    			attr_dev(svg6, "viewBox", "0 0 24 24");
    			attr_dev(svg6, "fill", "none");
    			attr_dev(svg6, "stroke", "currentColor");
    			attr_dev(svg6, "stroke-width", "2");
    			attr_dev(svg6, "stroke-linecap", "round");
    			attr_dev(svg6, "stroke-linejoin", "round");
    			attr_dev(svg6, "class", "feather feather-layers");
    			add_location(svg6, file$4, 287, 14, 8811);
    			attr_dev(a5, "class", "nav-link");
    			attr_dev(a5, "href", "#");
    			add_location(a5, file$4, 286, 12, 8767);
    			attr_dev(li5, "class", "nav-item");
    			add_location(li5, file$4, 285, 10, 8733);
    			attr_dev(ul0, "class", "nav flex-column");
    			add_location(ul0, file$4, 184, 8, 5069);
    			add_location(span, file$4, 308, 10, 9571);
    			attr_dev(circle3, "cx", "12");
    			attr_dev(circle3, "cy", "12");
    			attr_dev(circle3, "r", "10");
    			add_location(circle3, file$4, 320, 50, 10043);
    			attr_dev(line6, "x1", "12");
    			attr_dev(line6, "y1", "8");
    			attr_dev(line6, "x2", "12");
    			attr_dev(line6, "y2", "16");
    			add_location(line6, file$4, 324, 14, 10139);
    			attr_dev(line7, "x1", "8");
    			attr_dev(line7, "y1", "12");
    			attr_dev(line7, "x2", "16");
    			attr_dev(line7, "y2", "12");
    			add_location(line7, file$4, 325, 14, 10193);
    			attr_dev(svg7, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg7, "width", "24");
    			attr_dev(svg7, "height", "24");
    			attr_dev(svg7, "viewBox", "0 0 24 24");
    			attr_dev(svg7, "fill", "none");
    			attr_dev(svg7, "stroke", "currentColor");
    			attr_dev(svg7, "stroke-width", "2");
    			attr_dev(svg7, "stroke-linecap", "round");
    			attr_dev(svg7, "stroke-linejoin", "round");
    			attr_dev(svg7, "class", "feather feather-plus-circle");
    			add_location(svg7, file$4, 310, 12, 9686);
    			attr_dev(a6, "class", "link-secondary");
    			attr_dev(a6, "href", "#");
    			attr_dev(a6, "aria-label", "Add a new report");
    			add_location(a6, file$4, 309, 10, 9608);
    			attr_dev(h6, "class", "sidebar-heading d-flex justify-content-between align-items-center px-3 mt-4 mb-1 text-muted");
    			add_location(h6, file$4, 306, 8, 9446);
    			attr_dev(path6, "d", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z");
    			add_location(path6, file$4, 341, 50, 10773);
    			attr_dev(polyline4, "points", "14 2 14 8 20 8");
    			add_location(polyline4, file$4, 343, 16, 10879);
    			attr_dev(line8, "x1", "16");
    			attr_dev(line8, "y1", "13");
    			attr_dev(line8, "x2", "8");
    			attr_dev(line8, "y2", "13");
    			add_location(line8, file$4, 344, 16, 10932);
    			attr_dev(line9, "x1", "16");
    			attr_dev(line9, "y1", "17");
    			attr_dev(line9, "x2", "8");
    			attr_dev(line9, "y2", "17");
    			add_location(line9, file$4, 345, 16, 10988);
    			attr_dev(polyline5, "points", "10 9 9 9 8 9");
    			add_location(polyline5, file$4, 346, 16, 11044);
    			attr_dev(svg8, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg8, "width", "24");
    			attr_dev(svg8, "height", "24");
    			attr_dev(svg8, "viewBox", "0 0 24 24");
    			attr_dev(svg8, "fill", "none");
    			attr_dev(svg8, "stroke", "currentColor");
    			attr_dev(svg8, "stroke-width", "2");
    			attr_dev(svg8, "stroke-linecap", "round");
    			attr_dev(svg8, "stroke-linejoin", "round");
    			attr_dev(svg8, "class", "feather feather-file-text");
    			add_location(svg8, file$4, 331, 14, 10398);
    			attr_dev(a7, "class", "nav-link");
    			attr_dev(a7, "href", "#");
    			add_location(a7, file$4, 330, 12, 10354);
    			attr_dev(li6, "class", "nav-item");
    			add_location(li6, file$4, 329, 10, 10320);
    			attr_dev(path7, "d", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z");
    			add_location(path7, file$4, 362, 50, 11609);
    			attr_dev(polyline6, "points", "14 2 14 8 20 8");
    			add_location(polyline6, file$4, 364, 16, 11715);
    			attr_dev(line10, "x1", "16");
    			attr_dev(line10, "y1", "13");
    			attr_dev(line10, "x2", "8");
    			attr_dev(line10, "y2", "13");
    			add_location(line10, file$4, 365, 16, 11768);
    			attr_dev(line11, "x1", "16");
    			attr_dev(line11, "y1", "17");
    			attr_dev(line11, "x2", "8");
    			attr_dev(line11, "y2", "17");
    			add_location(line11, file$4, 366, 16, 11824);
    			attr_dev(polyline7, "points", "10 9 9 9 8 9");
    			add_location(polyline7, file$4, 367, 16, 11880);
    			attr_dev(svg9, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg9, "width", "24");
    			attr_dev(svg9, "height", "24");
    			attr_dev(svg9, "viewBox", "0 0 24 24");
    			attr_dev(svg9, "fill", "none");
    			attr_dev(svg9, "stroke", "currentColor");
    			attr_dev(svg9, "stroke-width", "2");
    			attr_dev(svg9, "stroke-linecap", "round");
    			attr_dev(svg9, "stroke-linejoin", "round");
    			attr_dev(svg9, "class", "feather feather-file-text");
    			add_location(svg9, file$4, 352, 14, 11234);
    			attr_dev(a8, "class", "nav-link");
    			attr_dev(a8, "href", "#");
    			add_location(a8, file$4, 351, 12, 11190);
    			attr_dev(li7, "class", "nav-item");
    			add_location(li7, file$4, 350, 10, 11156);
    			attr_dev(path8, "d", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z");
    			add_location(path8, file$4, 383, 50, 12444);
    			attr_dev(polyline8, "points", "14 2 14 8 20 8");
    			add_location(polyline8, file$4, 385, 16, 12550);
    			attr_dev(line12, "x1", "16");
    			attr_dev(line12, "y1", "13");
    			attr_dev(line12, "x2", "8");
    			attr_dev(line12, "y2", "13");
    			add_location(line12, file$4, 386, 16, 12603);
    			attr_dev(line13, "x1", "16");
    			attr_dev(line13, "y1", "17");
    			attr_dev(line13, "x2", "8");
    			attr_dev(line13, "y2", "17");
    			add_location(line13, file$4, 387, 16, 12659);
    			attr_dev(polyline9, "points", "10 9 9 9 8 9");
    			add_location(polyline9, file$4, 388, 16, 12715);
    			attr_dev(svg10, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg10, "width", "24");
    			attr_dev(svg10, "height", "24");
    			attr_dev(svg10, "viewBox", "0 0 24 24");
    			attr_dev(svg10, "fill", "none");
    			attr_dev(svg10, "stroke", "currentColor");
    			attr_dev(svg10, "stroke-width", "2");
    			attr_dev(svg10, "stroke-linecap", "round");
    			attr_dev(svg10, "stroke-linejoin", "round");
    			attr_dev(svg10, "class", "feather feather-file-text");
    			add_location(svg10, file$4, 373, 14, 12069);
    			attr_dev(a9, "class", "nav-link");
    			attr_dev(a9, "href", "#");
    			add_location(a9, file$4, 372, 12, 12025);
    			attr_dev(li8, "class", "nav-item");
    			add_location(li8, file$4, 371, 10, 11991);
    			attr_dev(path9, "d", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z");
    			add_location(path9, file$4, 404, 50, 13284);
    			attr_dev(polyline10, "points", "14 2 14 8 20 8");
    			add_location(polyline10, file$4, 406, 16, 13390);
    			attr_dev(line14, "x1", "16");
    			attr_dev(line14, "y1", "13");
    			attr_dev(line14, "x2", "8");
    			attr_dev(line14, "y2", "13");
    			add_location(line14, file$4, 407, 16, 13443);
    			attr_dev(line15, "x1", "16");
    			attr_dev(line15, "y1", "17");
    			attr_dev(line15, "x2", "8");
    			attr_dev(line15, "y2", "17");
    			add_location(line15, file$4, 408, 16, 13499);
    			attr_dev(polyline11, "points", "10 9 9 9 8 9");
    			add_location(polyline11, file$4, 409, 16, 13555);
    			attr_dev(svg11, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg11, "width", "24");
    			attr_dev(svg11, "height", "24");
    			attr_dev(svg11, "viewBox", "0 0 24 24");
    			attr_dev(svg11, "fill", "none");
    			attr_dev(svg11, "stroke", "currentColor");
    			attr_dev(svg11, "stroke-width", "2");
    			attr_dev(svg11, "stroke-linecap", "round");
    			attr_dev(svg11, "stroke-linejoin", "round");
    			attr_dev(svg11, "class", "feather feather-file-text");
    			add_location(svg11, file$4, 394, 14, 12909);
    			attr_dev(a10, "class", "nav-link");
    			attr_dev(a10, "href", "#");
    			add_location(a10, file$4, 393, 12, 12865);
    			attr_dev(li9, "class", "nav-item");
    			add_location(li9, file$4, 392, 10, 12831);
    			attr_dev(ul1, "class", "nav flex-column mb-2");
    			add_location(ul1, file$4, 328, 8, 10276);
    			attr_dev(div4, "class", "position-sticky pt-3");
    			add_location(div4, file$4, 183, 6, 5026);
    			attr_dev(nav, "id", "sidebarMenu");
    			attr_dev(nav, "class", "col-md-3 col-lg-2 d-md-block bg-light sidebar collapse");
    			add_location(nav, file$4, 180, 4, 4922);
    			attr_dev(div5, "class", "row");
    			add_location(div5, file$4, 7, 2, 118);
    			attr_dev(div6, "class", "container-fluid");
    			add_location(div6, file$4, 6, 0, 86);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div6, anchor);
    			append_dev(div6, div5);
    			append_dev(div5, main);
    			append_dev(main, div2);
    			append_dev(div2, h1);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			append_dev(div0, button0);
    			append_dev(div0, t3);
    			append_dev(div0, button1);
    			append_dev(div1, t5);
    			append_dev(div1, button2);
    			append_dev(button2, svg0);
    			append_dev(svg0, rect);
    			append_dev(svg0, line0);
    			append_dev(svg0, line1);
    			append_dev(svg0, line2);
    			append_dev(button2, t6);
    			append_dev(main, t7);
    			mount_component(timer, main, null);
    			append_dev(main, t8);
    			append_dev(main, h2);
    			append_dev(main, t10);
    			append_dev(main, div3);
    			append_dev(div3, table);
    			append_dev(table, thead);
    			append_dev(thead, tr0);
    			append_dev(tr0, th0);
    			append_dev(tr0, t12);
    			append_dev(tr0, th1);
    			append_dev(tr0, t14);
    			append_dev(tr0, th2);
    			append_dev(tr0, t16);
    			append_dev(tr0, th3);
    			append_dev(tr0, t18);
    			append_dev(tr0, th4);
    			append_dev(table, t20);
    			append_dev(table, tbody);
    			append_dev(tbody, tr1);
    			append_dev(tr1, td0);
    			append_dev(tr1, t22);
    			append_dev(tr1, td1);
    			append_dev(tr1, t24);
    			append_dev(tr1, td2);
    			append_dev(tr1, t26);
    			append_dev(tr1, td3);
    			append_dev(tr1, t28);
    			append_dev(tr1, td4);
    			append_dev(tbody, t30);
    			append_dev(tbody, tr2);
    			append_dev(tr2, td5);
    			append_dev(tr2, t32);
    			append_dev(tr2, td6);
    			append_dev(tr2, t34);
    			append_dev(tr2, td7);
    			append_dev(tr2, t36);
    			append_dev(tr2, td8);
    			append_dev(tr2, t38);
    			append_dev(tr2, td9);
    			append_dev(tbody, t40);
    			append_dev(tbody, tr3);
    			append_dev(tr3, td10);
    			append_dev(tr3, t42);
    			append_dev(tr3, td11);
    			append_dev(tr3, t44);
    			append_dev(tr3, td12);
    			append_dev(tr3, t46);
    			append_dev(tr3, td13);
    			append_dev(tr3, t48);
    			append_dev(tr3, td14);
    			append_dev(tbody, t50);
    			append_dev(tbody, tr4);
    			append_dev(tr4, td15);
    			append_dev(tr4, t52);
    			append_dev(tr4, td16);
    			append_dev(tr4, t54);
    			append_dev(tr4, td17);
    			append_dev(tr4, t56);
    			append_dev(tr4, td18);
    			append_dev(tr4, t58);
    			append_dev(tr4, td19);
    			append_dev(tbody, t60);
    			append_dev(tbody, tr5);
    			append_dev(tr5, td20);
    			append_dev(tr5, t62);
    			append_dev(tr5, td21);
    			append_dev(tr5, t64);
    			append_dev(tr5, td22);
    			append_dev(tr5, t66);
    			append_dev(tr5, td23);
    			append_dev(tr5, t68);
    			append_dev(tr5, td24);
    			append_dev(tbody, t70);
    			append_dev(tbody, tr6);
    			append_dev(tr6, td25);
    			append_dev(tr6, t72);
    			append_dev(tr6, td26);
    			append_dev(tr6, t74);
    			append_dev(tr6, td27);
    			append_dev(tr6, t76);
    			append_dev(tr6, td28);
    			append_dev(tr6, t78);
    			append_dev(tr6, td29);
    			append_dev(tbody, t80);
    			append_dev(tbody, tr7);
    			append_dev(tr7, td30);
    			append_dev(tr7, t82);
    			append_dev(tr7, td31);
    			append_dev(tr7, t84);
    			append_dev(tr7, td32);
    			append_dev(tr7, t86);
    			append_dev(tr7, td33);
    			append_dev(tr7, t88);
    			append_dev(tr7, td34);
    			append_dev(tbody, t90);
    			append_dev(tbody, tr8);
    			append_dev(tr8, td35);
    			append_dev(tr8, t92);
    			append_dev(tr8, td36);
    			append_dev(tr8, t94);
    			append_dev(tr8, td37);
    			append_dev(tr8, t96);
    			append_dev(tr8, td38);
    			append_dev(tr8, t98);
    			append_dev(tr8, td39);
    			append_dev(tbody, t100);
    			append_dev(tbody, tr9);
    			append_dev(tr9, td40);
    			append_dev(tr9, t102);
    			append_dev(tr9, td41);
    			append_dev(tr9, t104);
    			append_dev(tr9, td42);
    			append_dev(tr9, t106);
    			append_dev(tr9, td43);
    			append_dev(tr9, t108);
    			append_dev(tr9, td44);
    			append_dev(tbody, t110);
    			append_dev(tbody, tr10);
    			append_dev(tr10, td45);
    			append_dev(tr10, t112);
    			append_dev(tr10, td46);
    			append_dev(tr10, t114);
    			append_dev(tr10, td47);
    			append_dev(tr10, t116);
    			append_dev(tr10, td48);
    			append_dev(tr10, t118);
    			append_dev(tr10, td49);
    			append_dev(tbody, t120);
    			append_dev(tbody, tr11);
    			append_dev(tr11, td50);
    			append_dev(tr11, t122);
    			append_dev(tr11, td51);
    			append_dev(tr11, t124);
    			append_dev(tr11, td52);
    			append_dev(tr11, t126);
    			append_dev(tr11, td53);
    			append_dev(tr11, t128);
    			append_dev(tr11, td54);
    			append_dev(tbody, t130);
    			append_dev(tbody, tr12);
    			append_dev(tr12, td55);
    			append_dev(tr12, t132);
    			append_dev(tr12, td56);
    			append_dev(tr12, t134);
    			append_dev(tr12, td57);
    			append_dev(tr12, t136);
    			append_dev(tr12, td58);
    			append_dev(tr12, t138);
    			append_dev(tr12, td59);
    			append_dev(tbody, t140);
    			append_dev(tbody, tr13);
    			append_dev(tr13, td60);
    			append_dev(tr13, t142);
    			append_dev(tr13, td61);
    			append_dev(tr13, t144);
    			append_dev(tr13, td62);
    			append_dev(tr13, t146);
    			append_dev(tr13, td63);
    			append_dev(tr13, t148);
    			append_dev(tr13, td64);
    			append_dev(tbody, t150);
    			append_dev(tbody, tr14);
    			append_dev(tr14, td65);
    			append_dev(tr14, t152);
    			append_dev(tr14, td66);
    			append_dev(tr14, t154);
    			append_dev(tr14, td67);
    			append_dev(tr14, t156);
    			append_dev(tr14, td68);
    			append_dev(tr14, t158);
    			append_dev(tr14, td69);
    			append_dev(tbody, t160);
    			append_dev(tbody, tr15);
    			append_dev(tr15, td70);
    			append_dev(tr15, t162);
    			append_dev(tr15, td71);
    			append_dev(tr15, t164);
    			append_dev(tr15, td72);
    			append_dev(tr15, t166);
    			append_dev(tr15, td73);
    			append_dev(tr15, t168);
    			append_dev(tr15, td74);
    			append_dev(tbody, t170);
    			append_dev(tbody, tr16);
    			append_dev(tr16, td75);
    			append_dev(tr16, t172);
    			append_dev(tr16, td76);
    			append_dev(tr16, t174);
    			append_dev(tr16, td77);
    			append_dev(tr16, t176);
    			append_dev(tr16, td78);
    			append_dev(tr16, t178);
    			append_dev(tr16, td79);
    			append_dev(div5, t180);
    			append_dev(div5, nav);
    			append_dev(nav, div4);
    			append_dev(div4, ul0);
    			append_dev(ul0, li0);
    			append_dev(li0, a0);
    			append_dev(a0, svg1);
    			append_dev(svg1, path0);
    			append_dev(svg1, polyline0);
    			append_dev(a0, t181);
    			append_dev(ul0, t182);
    			append_dev(ul0, li1);
    			append_dev(li1, a1);
    			append_dev(a1, svg2);
    			append_dev(svg2, path1);
    			append_dev(svg2, polyline1);
    			append_dev(a1, t183);
    			append_dev(ul0, t184);
    			append_dev(ul0, li2);
    			append_dev(li2, a2);
    			append_dev(a2, svg3);
    			append_dev(svg3, circle0);
    			append_dev(svg3, circle1);
    			append_dev(svg3, path2);
    			append_dev(a2, t185);
    			append_dev(ul0, t186);
    			append_dev(ul0, li3);
    			append_dev(li3, a3);
    			append_dev(a3, svg4);
    			append_dev(svg4, path3);
    			append_dev(svg4, circle2);
    			append_dev(svg4, path4);
    			append_dev(svg4, path5);
    			append_dev(a3, t187);
    			append_dev(ul0, t188);
    			append_dev(ul0, li4);
    			append_dev(li4, a4);
    			append_dev(a4, svg5);
    			append_dev(svg5, line3);
    			append_dev(svg5, line4);
    			append_dev(svg5, line5);
    			append_dev(a4, t189);
    			append_dev(ul0, t190);
    			append_dev(ul0, li5);
    			append_dev(li5, a5);
    			append_dev(a5, svg6);
    			append_dev(svg6, polygon);
    			append_dev(svg6, polyline2);
    			append_dev(svg6, polyline3);
    			append_dev(a5, t191);
    			append_dev(div4, t192);
    			append_dev(div4, h6);
    			append_dev(h6, span);
    			append_dev(h6, t194);
    			append_dev(h6, a6);
    			append_dev(a6, svg7);
    			append_dev(svg7, circle3);
    			append_dev(svg7, line6);
    			append_dev(svg7, line7);
    			append_dev(div4, t195);
    			append_dev(div4, ul1);
    			append_dev(ul1, li6);
    			append_dev(li6, a7);
    			append_dev(a7, svg8);
    			append_dev(svg8, path6);
    			append_dev(svg8, polyline4);
    			append_dev(svg8, line8);
    			append_dev(svg8, line9);
    			append_dev(svg8, polyline5);
    			append_dev(a7, t196);
    			append_dev(ul1, t197);
    			append_dev(ul1, li7);
    			append_dev(li7, a8);
    			append_dev(a8, svg9);
    			append_dev(svg9, path7);
    			append_dev(svg9, polyline6);
    			append_dev(svg9, line10);
    			append_dev(svg9, line11);
    			append_dev(svg9, polyline7);
    			append_dev(a8, t198);
    			append_dev(ul1, t199);
    			append_dev(ul1, li8);
    			append_dev(li8, a9);
    			append_dev(a9, svg10);
    			append_dev(svg10, path8);
    			append_dev(svg10, polyline8);
    			append_dev(svg10, line12);
    			append_dev(svg10, line13);
    			append_dev(svg10, polyline9);
    			append_dev(a9, t200);
    			append_dev(ul1, t201);
    			append_dev(ul1, li9);
    			append_dev(li9, a10);
    			append_dev(a10, svg11);
    			append_dev(svg11, path9);
    			append_dev(svg11, polyline10);
    			append_dev(svg11, line14);
    			append_dev(svg11, line15);
    			append_dev(svg11, polyline11);
    			append_dev(a10, t202);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(timer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(timer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div6);
    			destroy_component(timer);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Solve", slots, []);
    	let { currentEvent } = $$props;
    	const writable_props = ["currentEvent"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Solve> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("currentEvent" in $$props) $$invalidate(0, currentEvent = $$props.currentEvent);
    	};

    	$$self.$capture_state = () => ({ Timer, currentEvent });

    	$$self.$inject_state = $$props => {
    		if ("currentEvent" in $$props) $$invalidate(0, currentEvent = $$props.currentEvent);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [currentEvent];
    }

    class Solve extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { currentEvent: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Solve",
    			options,
    			id: create_fragment$4.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*currentEvent*/ ctx[0] === undefined && !("currentEvent" in props)) {
    			console.warn("<Solve> was created without expected prop 'currentEvent'");
    		}
    	}

    	get currentEvent() {
    		throw new Error("<Solve>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set currentEvent(value) {
    		throw new Error("<Solve>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.29.7 */

    const { console: console_1 } = globals;
    const file$5 = "src/App.svelte";

    // (28:0) {:else}
    function create_else_block_1(ctx) {
    	let login;
    	let current;
    	login = new Login({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(login.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(login, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(login.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(login.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(login, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(28:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (22:0) {#if isLoggedin}
    function create_if_block$1(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_1$1, create_else_block$1];
    	const if_blocks = [];

    	function select_block_type_1(ctx, dirty) {
    		if (!/*currentEvent*/ ctx[1]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_1(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_1(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(22:0) {#if isLoggedin}",
    		ctx
    	});

    	return block;
    }

    // (25:2) {:else}
    function create_else_block$1(ctx) {
    	let solve;
    	let updating_currentEvent;
    	let current;

    	function solve_currentEvent_binding(value) {
    		/*solve_currentEvent_binding*/ ctx[5].call(null, value);
    	}

    	let solve_props = {};

    	if (/*currentEvent*/ ctx[1] !== void 0) {
    		solve_props.currentEvent = /*currentEvent*/ ctx[1];
    	}

    	solve = new Solve({ props: solve_props, $$inline: true });
    	binding_callbacks.push(() => bind(solve, "currentEvent", solve_currentEvent_binding));

    	const block = {
    		c: function create() {
    			create_component(solve.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(solve, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const solve_changes = {};

    			if (!updating_currentEvent && dirty & /*currentEvent*/ 2) {
    				updating_currentEvent = true;
    				solve_changes.currentEvent = /*currentEvent*/ ctx[1];
    				add_flush_callback(() => updating_currentEvent = false);
    			}

    			solve.$set(solve_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(solve.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(solve.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(solve, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(25:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (23:2) {#if !currentEvent}
    function create_if_block_1$1(ctx) {
    	let dashboard;
    	let updating_currentEvent;
    	let current;

    	function dashboard_currentEvent_binding(value) {
    		/*dashboard_currentEvent_binding*/ ctx[4].call(null, value);
    	}

    	let dashboard_props = {};

    	if (/*currentEvent*/ ctx[1] !== void 0) {
    		dashboard_props.currentEvent = /*currentEvent*/ ctx[1];
    	}

    	dashboard = new Dashboard({ props: dashboard_props, $$inline: true });
    	binding_callbacks.push(() => bind(dashboard, "currentEvent", dashboard_currentEvent_binding));

    	const block = {
    		c: function create() {
    			create_component(dashboard.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(dashboard, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const dashboard_changes = {};

    			if (!updating_currentEvent && dirty & /*currentEvent*/ 2) {
    				updating_currentEvent = true;
    				dashboard_changes.currentEvent = /*currentEvent*/ ctx[1];
    				add_flush_callback(() => updating_currentEvent = false);
    			}

    			dashboard.$set(dashboard_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(dashboard.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(dashboard.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(dashboard, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(23:2) {#if !currentEvent}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let navbar;
    	let updating_isLoggedin;
    	let updating_currentEvent;
    	let t0;
    	let div;
    	let t1;
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;

    	function navbar_isLoggedin_binding(value) {
    		/*navbar_isLoggedin_binding*/ ctx[2].call(null, value);
    	}

    	function navbar_currentEvent_binding(value) {
    		/*navbar_currentEvent_binding*/ ctx[3].call(null, value);
    	}

    	let navbar_props = {};

    	if (/*isLoggedin*/ ctx[0] !== void 0) {
    		navbar_props.isLoggedin = /*isLoggedin*/ ctx[0];
    	}

    	if (/*currentEvent*/ ctx[1] !== void 0) {
    		navbar_props.currentEvent = /*currentEvent*/ ctx[1];
    	}

    	navbar = new Navbar({ props: navbar_props, $$inline: true });
    	binding_callbacks.push(() => bind(navbar, "isLoggedin", navbar_isLoggedin_binding));
    	binding_callbacks.push(() => bind(navbar, "currentEvent", navbar_currentEvent_binding));
    	const if_block_creators = [create_if_block$1, create_else_block_1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*isLoggedin*/ ctx[0]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			create_component(navbar.$$.fragment);
    			t0 = space();
    			div = element("div");
    			t1 = space();
    			if_block.c();
    			if_block_anchor = empty();
    			attr_dev(div, "class", "spacing svelte-nl9otk");
    			add_location(div, file$5, 20, 0, 407);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(navbar, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div, anchor);
    			insert_dev(target, t1, anchor);
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const navbar_changes = {};

    			if (!updating_isLoggedin && dirty & /*isLoggedin*/ 1) {
    				updating_isLoggedin = true;
    				navbar_changes.isLoggedin = /*isLoggedin*/ ctx[0];
    				add_flush_callback(() => updating_isLoggedin = false);
    			}

    			if (!updating_currentEvent && dirty & /*currentEvent*/ 2) {
    				updating_currentEvent = true;
    				navbar_changes.currentEvent = /*currentEvent*/ ctx[1];
    				add_flush_callback(() => updating_currentEvent = false);
    			}

    			navbar.$set(navbar_changes);
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navbar.$$.fragment, local);
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navbar.$$.fragment, local);
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(navbar, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t1);
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let isLoggedin = false;
    	let currentEvent = "";
    	console.log(currentEvent);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function navbar_isLoggedin_binding(value) {
    		isLoggedin = value;
    		$$invalidate(0, isLoggedin);
    	}

    	function navbar_currentEvent_binding(value) {
    		currentEvent = value;
    		$$invalidate(1, currentEvent);
    	}

    	function dashboard_currentEvent_binding(value) {
    		currentEvent = value;
    		$$invalidate(1, currentEvent);
    	}

    	function solve_currentEvent_binding(value) {
    		currentEvent = value;
    		$$invalidate(1, currentEvent);
    	}

    	$$self.$capture_state = () => ({
    		Navbar,
    		Login,
    		Dashboard,
    		Solve,
    		isLoggedin,
    		currentEvent
    	});

    	$$self.$inject_state = $$props => {
    		if ("isLoggedin" in $$props) $$invalidate(0, isLoggedin = $$props.isLoggedin);
    		if ("currentEvent" in $$props) $$invalidate(1, currentEvent = $$props.currentEvent);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		isLoggedin,
    		currentEvent,
    		navbar_isLoggedin_binding,
    		navbar_currentEvent_binding,
    		dashboard_currentEvent_binding,
    		solve_currentEvent_binding
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    const app = new App({
      target: document.body,
      	intro: true,
      props: {
    	name: 'world',
      },
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
