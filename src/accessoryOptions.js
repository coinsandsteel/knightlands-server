const { Collections } = require("./database/database");

// TODO reset cache by request
class AccessoryOptions {
    constructor(db) {
        this._db = db;
        this._templates = new Map();
    }

    async init() {
        const meta = await this._db.collection(Collections.Meta).findOne({ _id: "craft_accessories" })
        for (const id in meta.options) {
            const option = meta.options[id];
            this._templates.set(+id, option);
        }
    }

    getOption(templateId) {
        let templates = this.getOptions(templateId);
        return templates.length == 1 ? templates[0] : null;
    }

    getOptions(templateIds, asLookupTable = false) {
        if (!Array.isArray(templateIds)) {
            templateIds = [templateIds];
        }

        let templatesToLoad = [];
        let templates = asLookupTable ? {} : [];

        {
            let i = 0;
            const length = templateIds.length;
            for (; i < length; i++) {
                let template = this._templates.get(templateIds[i]);
                if (!template) {
                    templatesToLoad.push(templateIds[i]);
                } else {
                    if (asLookupTable) {
                        templates[template._id] = template;
                    } else {
                        templates.push(template);
                    }
                }
            }
        }
        return templates;
    }
};

module.exports = AccessoryOptions;