const { Collections } = require("./database/database");

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

    async getTemplates(templateIds, asLookupTable = false) {
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


        if (templatesToLoad.length > 0) {
            let loadedTemplates = await this._items().find({
                _id: { $in: templatesToLoad }
            }).toArray();

            let i = 0;
            const length = loadedTemplates.length;
            for (; i < length; ++i) {
                let template = loadedTemplates[i];
                this._templates.set(template._id, template);
                
                if (asLookupTable) {
                    templates[template._id] = template;
                } else {
                    templates.push(template);
                }
            }
        }

        return templates;
    }

    _items() {
        return this._db.collection(Collections.Items);
    }
};

module.exports = ItemTemplates;