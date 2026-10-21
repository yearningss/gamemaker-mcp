/// @description MCP Commands - Random

function mcp_register_commands_random() {

    mcp_route("get_random_seed", function(_params) {
        return {
            seed: random_get_seed()
        };
    });

    mcp_route("set_random_seed", function(_params) {
        if (!variable_struct_exists(_params, "seed")) {
            return { __error: "Missing required parameter: seed", __code: -32602 };
        }

        var _seed = _params.seed;
        random_set_seed(_seed);

        return {
            seed: _seed,
            success: true
        };
    });

    mcp_route("randomize_seed", function(_params) {
        randomize();

        return {
            seed: random_get_seed(),
            success: true
        };
    });

    mcp_route("random_range_test", function(_params) {
        if (!variable_struct_exists(_params, "min")) {
            return { __error: "Missing required parameter: min", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "max")) {
            return { __error: "Missing required parameter: max", __code: -32602 };
        }

        var _min = _params.min;
        var _max = _params.max;

        if (_min >= _max) {
            return { __error: "min must be less than max", __code: -32602 };
        }

        var _count = 100;
        if (variable_struct_exists(_params, "count")) {
            _count = _params.count;
            if (_count < 1) {
                return { __error: "count must be at least 1", __code: -32602 };
            }
        }

        var _samples = [];
        var _sample_min = infinity;
        var _sample_max = -infinity;
        var _sum = 0;

        for (var _i = 0; _i < _count; _i++) {
            var _val = random_range(_min, _max);
            array_push(_samples, _val);
            _sum += _val;
            if (_val < _sample_min) _sample_min = _val;
            if (_val > _sample_max) _sample_max = _val;
        }

        var _mean = _sum / _count;

        return {
            range_min: _min,
            range_max: _max,
            count: _count,
            sample_min: _sample_min,
            sample_max: _sample_max,
            mean: _mean,
            samples: _samples
        };
    });
}
