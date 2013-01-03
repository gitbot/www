---
extends: false
uses_template: true
combine:
        root: media/js
        recurse: true
        where: top
        remove: yes
        sort: false
        files:
            - jquery.cookie.js
            - behave.js
            - superagent.js
            - dust.js
            - page.js
            - sachet.js
            - app.js
---

//
//
//

/**
 * Templates
 */
{% set dusts =  site.content.node_from_relative_path("media/templates") -%}
{% for dust in dusts.walk_resources() if dust.source.kind == 'dust' -%}
{% refer to dust.relative_path as d -%}
{{ d.html }}
{% endfor %}

;$(function() {
    Apt.app = new Apt.MainController();
});