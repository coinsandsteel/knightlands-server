const { Collections } = require("./database");

// TODO reset cache by request
class ItemTemplates {
    constructor(db) {
        this._db = db;
        this._templates = new Map();
    }

    async getTemplate(templateId) {
        let templates = await this.getTemplates(templateId);
        return templates.length == 1 ? templates[0] : null;
    }

    async getTemplates(templateIds) {
        if (!Array.isArray(templateIds)) {
            templateIds = [templateIds];
        }

        let templatesToLoad = [];
        let templates = [];

        {
            let i = 0;
            const length = templateIds.length;
            for (; i < length; i++) {
                let template = this._templates.get(templateIds[i]);
                if (!template) {
                    templatesToLoad.push(templateIds[i]);
                } else {
                    templates.push(template);
                }
            }
        }


        if (templatesToLoad.length > 0) {
            let loadedTemplates = await this._items().find({
                _id: { $in: templatesToLoad }
            }).toArray();

            let i = 0;
            const length = loadedTemplates.length;
            for (; i < length; ++i) {
                let t = loadedTemplates[i];
                this._templates.set(t._id, t);
                templates.push(t);
            }
        }

        return templates;
    }

    _items() {
        return this._db.collection(Collections.Items);
    }
};

module.exports = ItemTemplates;