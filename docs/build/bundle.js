
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

    // (55:4) {:else}
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
    			add_location(a, file, 55, 6, 1736);
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
    		source: "(55:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (12:4) {#if isLoggedin}
    function create_if_block(ctx) {
    	let button;
    	let span;
    	let t0;
    	let div2;
    	let div1;
    	let div0;
    	let t2;
    	let if_block = /*currentEvent*/ ctx[1] && create_if_block_1(ctx);

    	const block = {
    		c: function create() {
    			button = element("button");
    			span = element("span");
    			t0 = space();
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			div0.textContent = "Rankings";
    			t2 = space();
    			if (if_block) if_block.c();
    			attr_dev(span, "class", "navbar-toggler-icon");
    			add_location(span, file, 20, 8, 589);
    			attr_dev(button, "class", "navbar-toggler");
    			attr_dev(button, "type", "button");
    			attr_dev(button, "data-toggle", "collapse");
    			attr_dev(button, "data-target", "#navbarText");
    			attr_dev(button, "aria-controls", "navbarText");
    			attr_dev(button, "aria-expanded", "false");
    			attr_dev(button, "aria-label", "Toggle navigation");
    			add_location(button, file, 12, 6, 350);
    			attr_dev(div0, "class", "nav-link");
    			attr_dev(div0, "href", "#");
    			add_location(div0, file, 25, 10, 768);
    			attr_dev(div1, "class", "navbar-nav mr-auto mb-2 mb-lg-0");
    			add_location(div1, file, 24, 8, 712);
    			attr_dev(div2, "class", "collapse navbar-collapse");
    			attr_dev(div2, "id", "navbarText");
    			add_location(div2, file, 23, 6, 649);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, span);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			append_dev(div2, t2);
    			if (if_block) if_block.m(div2, null);
    		},
    		p: function update(ctx, dirty) {
    			if (/*currentEvent*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1(ctx);
    					if_block.c();
    					if_block.m(div2, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div2);
    			if (if_block) if_block.d();
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

    // (28:8) {#if currentEvent}
    function create_if_block_1(ctx) {
    	let span;
    	let button;
    	let t0;
    	let t1;
    	let div;
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
    			span = element("span");
    			button = element("button");
    			t0 = text(/*currentEvent*/ ctx[1]);
    			t1 = space();
    			div = element("div");
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
    			add_location(button, file, 29, 12, 902);
    			attr_dev(h6, "class", "dropdown-header");
    			add_location(h6, file, 41, 14, 1330);
    			attr_dev(div, "class", "dropdown-menu dropdown-menu-sm-right");
    			attr_dev(div, "aria-labelledby", "navbarDropdown");
    			add_location(div, file, 38, 12, 1204);
    			attr_dev(span, "class", "dropdown");
    			add_location(span, file, 28, 10, 866);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			append_dev(span, button);
    			append_dev(button, t0);
    			append_dev(span, t1);
    			append_dev(span, div);
    			append_dev(div, h6);
    			append_dev(div, t3);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*currentEvent*/ 2) set_data_dev(t0, /*currentEvent*/ ctx[1]);

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
    						each_blocks[i].m(div, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(28:8) {#if currentEvent}",
    		ctx
    	});

    	return block;
    }

    // (44:16) {#if e !== currentEvent}
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
    			add_location(button, file, 44, 18, 1462);
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
    		source: "(44:16) {#if e !== currentEvent}",
    		ctx
    	});

    	return block;
    }

    // (43:14) {#each events as e}
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
    		source: "(43:14) {#each events as e}",
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
    			add_location(div0, file, 8, 4, 224);
    			attr_dev(div1, "class", "container-fluid");
    			add_location(div1, file, 7, 2, 190);
    			attr_dev(nav, "class", "navbar navbar-expand-sm navbar-dark bg-dark fixed-top");
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
    			h1.textContent = "CUBE COMPETITIONS";
    			t1 = space();
    			p = element("p");
    			p.textContent = "You must log in to discord to continue";
    			attr_dev(h1, "class", "display-3");
    			add_location(h1, file$1, 12, 2, 198);
    			attr_dev(p, "class", "lead");
    			add_location(p, file$1, 13, 2, 245);
    			attr_dev(main, "class", "text-center svelte-bv9sba");
    			add_location(main, file$1, 11, 0, 132);
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
    			add_location(img, file$2, 24, 10, 668);
    			attr_dev(h4, "class", "");
    			add_location(h4, file$2, 26, 12, 786);
    			attr_dev(div0, "class", "card-footer bg-transparent");
    			add_location(div0, file$2, 25, 10, 733);
    			attr_dev(div1, "class", "card svelte-81ewok");
    			add_location(div1, file$2, 23, 8, 603);
    			attr_dev(div2, "class", "col mt-4");
    			add_location(div2, file$2, 22, 6, 572);
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
    	let div1_intro;
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
    			add_location(div0, file$2, 19, 2, 455);
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
    			if (!div1_intro) {
    				add_render_callback(() => {
    					div1_intro = create_in_transition(div1, fade, { duration: 250 });
    					div1_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_each(each_blocks, detaching);
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
    	let div3;
    	let div2;
    	let main;
    	let div0;
    	let h1;
    	let t1;
    	let timer;
    	let t2;
    	let nav;
    	let div1;
    	let ul0;
    	let li0;
    	let a0;
    	let svg0;
    	let path0;
    	let polyline0;
    	let t3;
    	let t4;
    	let li1;
    	let a1;
    	let svg1;
    	let path1;
    	let polyline1;
    	let t5;
    	let t6;
    	let li2;
    	let a2;
    	let svg2;
    	let circle0;
    	let circle1;
    	let path2;
    	let t7;
    	let t8;
    	let li3;
    	let a3;
    	let svg3;
    	let path3;
    	let circle2;
    	let path4;
    	let path5;
    	let t9;
    	let t10;
    	let li4;
    	let a4;
    	let svg4;
    	let line0;
    	let line1;
    	let line2;
    	let t11;
    	let t12;
    	let li5;
    	let a5;
    	let svg5;
    	let polygon;
    	let polyline2;
    	let polyline3;
    	let t13;
    	let t14;
    	let h6;
    	let span;
    	let t16;
    	let a6;
    	let svg6;
    	let circle3;
    	let line3;
    	let line4;
    	let t17;
    	let ul1;
    	let li6;
    	let a7;
    	let svg7;
    	let path6;
    	let polyline4;
    	let line5;
    	let line6;
    	let polyline5;
    	let t18;
    	let t19;
    	let li7;
    	let a8;
    	let svg8;
    	let path7;
    	let polyline6;
    	let line7;
    	let line8;
    	let polyline7;
    	let t20;
    	let t21;
    	let li8;
    	let a9;
    	let svg9;
    	let path8;
    	let polyline8;
    	let line9;
    	let line10;
    	let polyline9;
    	let t22;
    	let t23;
    	let li9;
    	let a10;
    	let svg10;
    	let path9;
    	let polyline10;
    	let line11;
    	let line12;
    	let polyline11;
    	let t24;
    	let div3_intro;
    	let current;
    	timer = new Timer({ $$inline: true });

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div2 = element("div");
    			main = element("main");
    			div0 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Scramble";
    			t1 = space();
    			create_component(timer.$$.fragment);
    			t2 = space();
    			nav = element("nav");
    			div1 = element("div");
    			ul0 = element("ul");
    			li0 = element("li");
    			a0 = element("a");
    			svg0 = svg_element("svg");
    			path0 = svg_element("path");
    			polyline0 = svg_element("polyline");
    			t3 = text("\n              Dashboard");
    			t4 = space();
    			li1 = element("li");
    			a1 = element("a");
    			svg1 = svg_element("svg");
    			path1 = svg_element("path");
    			polyline1 = svg_element("polyline");
    			t5 = text("\n              Orders");
    			t6 = space();
    			li2 = element("li");
    			a2 = element("a");
    			svg2 = svg_element("svg");
    			circle0 = svg_element("circle");
    			circle1 = svg_element("circle");
    			path2 = svg_element("path");
    			t7 = text("\n              Products");
    			t8 = space();
    			li3 = element("li");
    			a3 = element("a");
    			svg3 = svg_element("svg");
    			path3 = svg_element("path");
    			circle2 = svg_element("circle");
    			path4 = svg_element("path");
    			path5 = svg_element("path");
    			t9 = text("\n              Customers");
    			t10 = space();
    			li4 = element("li");
    			a4 = element("a");
    			svg4 = svg_element("svg");
    			line0 = svg_element("line");
    			line1 = svg_element("line");
    			line2 = svg_element("line");
    			t11 = text("\n              Reports");
    			t12 = space();
    			li5 = element("li");
    			a5 = element("a");
    			svg5 = svg_element("svg");
    			polygon = svg_element("polygon");
    			polyline2 = svg_element("polyline");
    			polyline3 = svg_element("polyline");
    			t13 = text("\n              Integrations");
    			t14 = space();
    			h6 = element("h6");
    			span = element("span");
    			span.textContent = "Saved reports";
    			t16 = space();
    			a6 = element("a");
    			svg6 = svg_element("svg");
    			circle3 = svg_element("circle");
    			line3 = svg_element("line");
    			line4 = svg_element("line");
    			t17 = space();
    			ul1 = element("ul");
    			li6 = element("li");
    			a7 = element("a");
    			svg7 = svg_element("svg");
    			path6 = svg_element("path");
    			polyline4 = svg_element("polyline");
    			line5 = svg_element("line");
    			line6 = svg_element("line");
    			polyline5 = svg_element("polyline");
    			t18 = text("\n              Current month");
    			t19 = space();
    			li7 = element("li");
    			a8 = element("a");
    			svg8 = svg_element("svg");
    			path7 = svg_element("path");
    			polyline6 = svg_element("polyline");
    			line7 = svg_element("line");
    			line8 = svg_element("line");
    			polyline7 = svg_element("polyline");
    			t20 = text("\n              Last quarter");
    			t21 = space();
    			li8 = element("li");
    			a9 = element("a");
    			svg9 = svg_element("svg");
    			path8 = svg_element("path");
    			polyline8 = svg_element("polyline");
    			line9 = svg_element("line");
    			line10 = svg_element("line");
    			polyline9 = svg_element("polyline");
    			t22 = text("\n              Social engagement");
    			t23 = space();
    			li9 = element("li");
    			a10 = element("a");
    			svg10 = svg_element("svg");
    			path9 = svg_element("path");
    			polyline10 = svg_element("polyline");
    			line11 = svg_element("line");
    			line12 = svg_element("line");
    			polyline11 = svg_element("polyline");
    			t24 = text("\n              Year-end sale");
    			attr_dev(h1, "class", "h1 text-center");
    			add_location(h1, file$4, 12, 8, 281);
    			attr_dev(div0, "class", "pt-3 pb-2 mb-3");
    			add_location(div0, file$4, 11, 6, 244);
    			attr_dev(main, "class", "container");
    			add_location(main, file$4, 10, 4, 213);
    			attr_dev(path0, "d", "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z");
    			add_location(path0, file$4, 34, 45, 1029);
    			attr_dev(polyline0, "points", "9 22 9 12 15 12 15 22");
    			add_location(polyline0, file$4, 36, 16, 1123);
    			attr_dev(svg0, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg0, "width", "24");
    			attr_dev(svg0, "height", "24");
    			attr_dev(svg0, "viewBox", "0 0 24 24");
    			attr_dev(svg0, "fill", "none");
    			attr_dev(svg0, "stroke", "currentColor");
    			attr_dev(svg0, "stroke-width", "2");
    			attr_dev(svg0, "stroke-linecap", "round");
    			attr_dev(svg0, "stroke-linejoin", "round");
    			attr_dev(svg0, "class", "feather feather-home");
    			add_location(svg0, file$4, 24, 14, 659);
    			attr_dev(a0, "class", "nav-link active");
    			attr_dev(a0, "aria-current", "page");
    			attr_dev(a0, "href", "#");
    			add_location(a0, file$4, 23, 12, 588);
    			attr_dev(li0, "class", "nav-item");
    			add_location(li0, file$4, 22, 10, 554);
    			attr_dev(path1, "d", "M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z");
    			add_location(path1, file$4, 52, 45, 1688);
    			attr_dev(polyline1, "points", "13 2 13 9 20 9");
    			add_location(polyline1, file$4, 54, 16, 1794);
    			attr_dev(svg1, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg1, "width", "24");
    			attr_dev(svg1, "height", "24");
    			attr_dev(svg1, "viewBox", "0 0 24 24");
    			attr_dev(svg1, "fill", "none");
    			attr_dev(svg1, "stroke", "currentColor");
    			attr_dev(svg1, "stroke-width", "2");
    			attr_dev(svg1, "stroke-linecap", "round");
    			attr_dev(svg1, "stroke-linejoin", "round");
    			attr_dev(svg1, "class", "feather feather-file");
    			add_location(svg1, file$4, 42, 14, 1318);
    			attr_dev(a1, "class", "nav-link");
    			attr_dev(a1, "href", "#");
    			add_location(a1, file$4, 41, 12, 1274);
    			attr_dev(li1, "class", "nav-item");
    			add_location(li1, file$4, 40, 10, 1240);
    			attr_dev(circle0, "cx", "9");
    			attr_dev(circle0, "cy", "21");
    			attr_dev(circle0, "r", "1");
    			add_location(circle0, file$4, 70, 54, 2358);
    			attr_dev(circle1, "cx", "20");
    			attr_dev(circle1, "cy", "21");
    			attr_dev(circle1, "r", "1");
    			add_location(circle1, file$4, 74, 16, 2460);
    			attr_dev(path2, "d", "M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6");
    			add_location(path2, file$4, 75, 16, 2509);
    			attr_dev(svg2, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg2, "width", "24");
    			attr_dev(svg2, "height", "24");
    			attr_dev(svg2, "viewBox", "0 0 24 24");
    			attr_dev(svg2, "fill", "none");
    			attr_dev(svg2, "stroke", "currentColor");
    			attr_dev(svg2, "stroke-width", "2");
    			attr_dev(svg2, "stroke-linecap", "round");
    			attr_dev(svg2, "stroke-linejoin", "round");
    			attr_dev(svg2, "class", "feather feather-shopping-cart");
    			add_location(svg2, file$4, 60, 14, 1979);
    			attr_dev(a2, "class", "nav-link");
    			attr_dev(a2, "href", "#");
    			add_location(a2, file$4, 59, 12, 1935);
    			attr_dev(li2, "class", "nav-item");
    			add_location(li2, file$4, 58, 10, 1901);
    			attr_dev(path3, "d", "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2");
    			add_location(path3, file$4, 92, 46, 3125);
    			attr_dev(circle2, "cx", "9");
    			attr_dev(circle2, "cy", "7");
    			attr_dev(circle2, "r", "4");
    			add_location(circle2, file$4, 94, 16, 3214);
    			attr_dev(path4, "d", "M23 21v-2a4 4 0 0 0-3-3.87");
    			add_location(path4, file$4, 95, 16, 3261);
    			attr_dev(path5, "d", "M16 3.13a4 4 0 0 1 0 7.75");
    			add_location(path5, file$4, 96, 16, 3317);
    			attr_dev(svg3, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg3, "width", "24");
    			attr_dev(svg3, "height", "24");
    			attr_dev(svg3, "viewBox", "0 0 24 24");
    			attr_dev(svg3, "fill", "none");
    			attr_dev(svg3, "stroke", "currentColor");
    			attr_dev(svg3, "stroke-width", "2");
    			attr_dev(svg3, "stroke-linecap", "round");
    			attr_dev(svg3, "stroke-linejoin", "round");
    			attr_dev(svg3, "class", "feather feather-users");
    			add_location(svg3, file$4, 82, 14, 2754);
    			attr_dev(a3, "class", "nav-link");
    			attr_dev(a3, "href", "#");
    			add_location(a3, file$4, 81, 12, 2710);
    			attr_dev(li3, "class", "nav-item");
    			add_location(li3, file$4, 80, 10, 2676);
    			attr_dev(line0, "x1", "18");
    			attr_dev(line0, "y1", "20");
    			attr_dev(line0, "x2", "18");
    			attr_dev(line0, "y2", "10");
    			add_location(line0, file$4, 112, 52, 3884);
    			attr_dev(line1, "x1", "12");
    			attr_dev(line1, "y1", "20");
    			attr_dev(line1, "x2", "12");
    			attr_dev(line1, "y2", "4");
    			add_location(line1, file$4, 117, 16, 4013);
    			attr_dev(line2, "x1", "6");
    			attr_dev(line2, "y1", "20");
    			attr_dev(line2, "x2", "6");
    			attr_dev(line2, "y2", "14");
    			add_location(line2, file$4, 118, 16, 4069);
    			attr_dev(svg4, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg4, "width", "24");
    			attr_dev(svg4, "height", "24");
    			attr_dev(svg4, "viewBox", "0 0 24 24");
    			attr_dev(svg4, "fill", "none");
    			attr_dev(svg4, "stroke", "currentColor");
    			attr_dev(svg4, "stroke-width", "2");
    			attr_dev(svg4, "stroke-linecap", "round");
    			attr_dev(svg4, "stroke-linejoin", "round");
    			attr_dev(svg4, "class", "feather feather-bar-chart-2");
    			add_location(svg4, file$4, 102, 14, 3507);
    			attr_dev(a4, "class", "nav-link");
    			attr_dev(a4, "href", "#");
    			add_location(a4, file$4, 101, 12, 3463);
    			attr_dev(li4, "class", "nav-item");
    			add_location(li4, file$4, 100, 10, 3429);
    			attr_dev(polygon, "points", "12 2 2 7 12 12 22 7 12 2");
    			add_location(polygon, file$4, 134, 47, 4629);
    			attr_dev(polyline2, "points", "2 17 12 22 22 17");
    			add_location(polyline2, file$4, 136, 16, 4709);
    			attr_dev(polyline3, "points", "2 12 12 17 22 12");
    			add_location(polyline3, file$4, 137, 16, 4764);
    			attr_dev(svg5, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg5, "width", "24");
    			attr_dev(svg5, "height", "24");
    			attr_dev(svg5, "viewBox", "0 0 24 24");
    			attr_dev(svg5, "fill", "none");
    			attr_dev(svg5, "stroke", "currentColor");
    			attr_dev(svg5, "stroke-width", "2");
    			attr_dev(svg5, "stroke-linecap", "round");
    			attr_dev(svg5, "stroke-linejoin", "round");
    			attr_dev(svg5, "class", "feather feather-layers");
    			add_location(svg5, file$4, 124, 14, 4257);
    			attr_dev(a5, "class", "nav-link");
    			attr_dev(a5, "href", "#");
    			add_location(a5, file$4, 123, 12, 4213);
    			attr_dev(li5, "class", "nav-item");
    			add_location(li5, file$4, 122, 10, 4179);
    			attr_dev(ul0, "class", "nav flex-column");
    			add_location(ul0, file$4, 21, 8, 515);
    			add_location(span, file$4, 145, 10, 5017);
    			attr_dev(circle3, "cx", "12");
    			attr_dev(circle3, "cy", "12");
    			attr_dev(circle3, "r", "10");
    			add_location(circle3, file$4, 157, 50, 5489);
    			attr_dev(line3, "x1", "12");
    			attr_dev(line3, "y1", "8");
    			attr_dev(line3, "x2", "12");
    			attr_dev(line3, "y2", "16");
    			add_location(line3, file$4, 161, 14, 5585);
    			attr_dev(line4, "x1", "8");
    			attr_dev(line4, "y1", "12");
    			attr_dev(line4, "x2", "16");
    			attr_dev(line4, "y2", "12");
    			add_location(line4, file$4, 162, 14, 5639);
    			attr_dev(svg6, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg6, "width", "24");
    			attr_dev(svg6, "height", "24");
    			attr_dev(svg6, "viewBox", "0 0 24 24");
    			attr_dev(svg6, "fill", "none");
    			attr_dev(svg6, "stroke", "currentColor");
    			attr_dev(svg6, "stroke-width", "2");
    			attr_dev(svg6, "stroke-linecap", "round");
    			attr_dev(svg6, "stroke-linejoin", "round");
    			attr_dev(svg6, "class", "feather feather-plus-circle");
    			add_location(svg6, file$4, 147, 12, 5132);
    			attr_dev(a6, "class", "link-secondary");
    			attr_dev(a6, "href", "#");
    			attr_dev(a6, "aria-label", "Add a new report");
    			add_location(a6, file$4, 146, 10, 5054);
    			attr_dev(h6, "class", "sidebar-heading d-flex justify-content-between align-items-center px-3 mt-4 mb-1 text-muted");
    			add_location(h6, file$4, 143, 8, 4892);
    			attr_dev(path6, "d", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z");
    			add_location(path6, file$4, 178, 50, 6219);
    			attr_dev(polyline4, "points", "14 2 14 8 20 8");
    			add_location(polyline4, file$4, 180, 16, 6325);
    			attr_dev(line5, "x1", "16");
    			attr_dev(line5, "y1", "13");
    			attr_dev(line5, "x2", "8");
    			attr_dev(line5, "y2", "13");
    			add_location(line5, file$4, 181, 16, 6378);
    			attr_dev(line6, "x1", "16");
    			attr_dev(line6, "y1", "17");
    			attr_dev(line6, "x2", "8");
    			attr_dev(line6, "y2", "17");
    			add_location(line6, file$4, 182, 16, 6434);
    			attr_dev(polyline5, "points", "10 9 9 9 8 9");
    			add_location(polyline5, file$4, 183, 16, 6490);
    			attr_dev(svg7, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg7, "width", "24");
    			attr_dev(svg7, "height", "24");
    			attr_dev(svg7, "viewBox", "0 0 24 24");
    			attr_dev(svg7, "fill", "none");
    			attr_dev(svg7, "stroke", "currentColor");
    			attr_dev(svg7, "stroke-width", "2");
    			attr_dev(svg7, "stroke-linecap", "round");
    			attr_dev(svg7, "stroke-linejoin", "round");
    			attr_dev(svg7, "class", "feather feather-file-text");
    			add_location(svg7, file$4, 168, 14, 5844);
    			attr_dev(a7, "class", "nav-link");
    			attr_dev(a7, "href", "#");
    			add_location(a7, file$4, 167, 12, 5800);
    			attr_dev(li6, "class", "nav-item");
    			add_location(li6, file$4, 166, 10, 5766);
    			attr_dev(path7, "d", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z");
    			add_location(path7, file$4, 199, 50, 7055);
    			attr_dev(polyline6, "points", "14 2 14 8 20 8");
    			add_location(polyline6, file$4, 201, 16, 7161);
    			attr_dev(line7, "x1", "16");
    			attr_dev(line7, "y1", "13");
    			attr_dev(line7, "x2", "8");
    			attr_dev(line7, "y2", "13");
    			add_location(line7, file$4, 202, 16, 7214);
    			attr_dev(line8, "x1", "16");
    			attr_dev(line8, "y1", "17");
    			attr_dev(line8, "x2", "8");
    			attr_dev(line8, "y2", "17");
    			add_location(line8, file$4, 203, 16, 7270);
    			attr_dev(polyline7, "points", "10 9 9 9 8 9");
    			add_location(polyline7, file$4, 204, 16, 7326);
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
    			add_location(svg8, file$4, 189, 14, 6680);
    			attr_dev(a8, "class", "nav-link");
    			attr_dev(a8, "href", "#");
    			add_location(a8, file$4, 188, 12, 6636);
    			attr_dev(li7, "class", "nav-item");
    			add_location(li7, file$4, 187, 10, 6602);
    			attr_dev(path8, "d", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z");
    			add_location(path8, file$4, 220, 50, 7890);
    			attr_dev(polyline8, "points", "14 2 14 8 20 8");
    			add_location(polyline8, file$4, 222, 16, 7996);
    			attr_dev(line9, "x1", "16");
    			attr_dev(line9, "y1", "13");
    			attr_dev(line9, "x2", "8");
    			attr_dev(line9, "y2", "13");
    			add_location(line9, file$4, 223, 16, 8049);
    			attr_dev(line10, "x1", "16");
    			attr_dev(line10, "y1", "17");
    			attr_dev(line10, "x2", "8");
    			attr_dev(line10, "y2", "17");
    			add_location(line10, file$4, 224, 16, 8105);
    			attr_dev(polyline9, "points", "10 9 9 9 8 9");
    			add_location(polyline9, file$4, 225, 16, 8161);
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
    			add_location(svg9, file$4, 210, 14, 7515);
    			attr_dev(a9, "class", "nav-link");
    			attr_dev(a9, "href", "#");
    			add_location(a9, file$4, 209, 12, 7471);
    			attr_dev(li8, "class", "nav-item");
    			add_location(li8, file$4, 208, 10, 7437);
    			attr_dev(path9, "d", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z");
    			add_location(path9, file$4, 241, 50, 8730);
    			attr_dev(polyline10, "points", "14 2 14 8 20 8");
    			add_location(polyline10, file$4, 243, 16, 8836);
    			attr_dev(line11, "x1", "16");
    			attr_dev(line11, "y1", "13");
    			attr_dev(line11, "x2", "8");
    			attr_dev(line11, "y2", "13");
    			add_location(line11, file$4, 244, 16, 8889);
    			attr_dev(line12, "x1", "16");
    			attr_dev(line12, "y1", "17");
    			attr_dev(line12, "x2", "8");
    			attr_dev(line12, "y2", "17");
    			add_location(line12, file$4, 245, 16, 8945);
    			attr_dev(polyline11, "points", "10 9 9 9 8 9");
    			add_location(polyline11, file$4, 246, 16, 9001);
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
    			add_location(svg10, file$4, 231, 14, 8355);
    			attr_dev(a10, "class", "nav-link");
    			attr_dev(a10, "href", "#");
    			add_location(a10, file$4, 230, 12, 8311);
    			attr_dev(li9, "class", "nav-item");
    			add_location(li9, file$4, 229, 10, 8277);
    			attr_dev(ul1, "class", "nav flex-column mb-2");
    			add_location(ul1, file$4, 165, 8, 5722);
    			attr_dev(div1, "class", "position-sticky pt-3");
    			add_location(div1, file$4, 20, 6, 472);
    			attr_dev(nav, "id", "sidebarMenu");
    			attr_dev(nav, "class", "col-md-3 col-lg-2 d-md-block bg-light sidebar collapse");
    			add_location(nav, file$4, 17, 4, 368);
    			attr_dev(div2, "class", "row");
    			add_location(div2, file$4, 9, 2, 191);
    			attr_dev(div3, "class", "container-fluid");
    			add_location(div3, file$4, 8, 0, 131);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div2);
    			append_dev(div2, main);
    			append_dev(main, div0);
    			append_dev(div0, h1);
    			append_dev(main, t1);
    			mount_component(timer, main, null);
    			append_dev(div2, t2);
    			append_dev(div2, nav);
    			append_dev(nav, div1);
    			append_dev(div1, ul0);
    			append_dev(ul0, li0);
    			append_dev(li0, a0);
    			append_dev(a0, svg0);
    			append_dev(svg0, path0);
    			append_dev(svg0, polyline0);
    			append_dev(a0, t3);
    			append_dev(ul0, t4);
    			append_dev(ul0, li1);
    			append_dev(li1, a1);
    			append_dev(a1, svg1);
    			append_dev(svg1, path1);
    			append_dev(svg1, polyline1);
    			append_dev(a1, t5);
    			append_dev(ul0, t6);
    			append_dev(ul0, li2);
    			append_dev(li2, a2);
    			append_dev(a2, svg2);
    			append_dev(svg2, circle0);
    			append_dev(svg2, circle1);
    			append_dev(svg2, path2);
    			append_dev(a2, t7);
    			append_dev(ul0, t8);
    			append_dev(ul0, li3);
    			append_dev(li3, a3);
    			append_dev(a3, svg3);
    			append_dev(svg3, path3);
    			append_dev(svg3, circle2);
    			append_dev(svg3, path4);
    			append_dev(svg3, path5);
    			append_dev(a3, t9);
    			append_dev(ul0, t10);
    			append_dev(ul0, li4);
    			append_dev(li4, a4);
    			append_dev(a4, svg4);
    			append_dev(svg4, line0);
    			append_dev(svg4, line1);
    			append_dev(svg4, line2);
    			append_dev(a4, t11);
    			append_dev(ul0, t12);
    			append_dev(ul0, li5);
    			append_dev(li5, a5);
    			append_dev(a5, svg5);
    			append_dev(svg5, polygon);
    			append_dev(svg5, polyline2);
    			append_dev(svg5, polyline3);
    			append_dev(a5, t13);
    			append_dev(div1, t14);
    			append_dev(div1, h6);
    			append_dev(h6, span);
    			append_dev(h6, t16);
    			append_dev(h6, a6);
    			append_dev(a6, svg6);
    			append_dev(svg6, circle3);
    			append_dev(svg6, line3);
    			append_dev(svg6, line4);
    			append_dev(div1, t17);
    			append_dev(div1, ul1);
    			append_dev(ul1, li6);
    			append_dev(li6, a7);
    			append_dev(a7, svg7);
    			append_dev(svg7, path6);
    			append_dev(svg7, polyline4);
    			append_dev(svg7, line5);
    			append_dev(svg7, line6);
    			append_dev(svg7, polyline5);
    			append_dev(a7, t18);
    			append_dev(ul1, t19);
    			append_dev(ul1, li7);
    			append_dev(li7, a8);
    			append_dev(a8, svg8);
    			append_dev(svg8, path7);
    			append_dev(svg8, polyline6);
    			append_dev(svg8, line7);
    			append_dev(svg8, line8);
    			append_dev(svg8, polyline7);
    			append_dev(a8, t20);
    			append_dev(ul1, t21);
    			append_dev(ul1, li8);
    			append_dev(li8, a9);
    			append_dev(a9, svg9);
    			append_dev(svg9, path8);
    			append_dev(svg9, polyline8);
    			append_dev(svg9, line9);
    			append_dev(svg9, line10);
    			append_dev(svg9, polyline9);
    			append_dev(a9, t22);
    			append_dev(ul1, t23);
    			append_dev(ul1, li9);
    			append_dev(li9, a10);
    			append_dev(a10, svg10);
    			append_dev(svg10, path9);
    			append_dev(svg10, polyline10);
    			append_dev(svg10, line11);
    			append_dev(svg10, line12);
    			append_dev(svg10, polyline11);
    			append_dev(a10, t24);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(timer.$$.fragment, local);

    			if (!div3_intro) {
    				add_render_callback(() => {
    					div3_intro = create_in_transition(div3, fade, { duration: 250 });
    					div3_intro.start();
    				});
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(timer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
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

    	$$self.$capture_state = () => ({ fade, Timer, currentEvent });

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
    const file$5 = "src/App.svelte";

    // (26:0) {:else}
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
    		source: "(26:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (20:0) {#if isLoggedin}
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
    		source: "(20:0) {#if isLoggedin}",
    		ctx
    	});

    	return block;
    }

    // (23:2) {:else}
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
    		source: "(23:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (21:2) {#if !currentEvent}
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
    		source: "(21:2) {#if !currentEvent}",
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
    			add_location(div, file$5, 18, 0, 377);
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
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
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
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
