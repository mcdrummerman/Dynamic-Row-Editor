// Constructor
function DynamicRowEditor(containerId, isSortable, allowLastRowDelete, optionalParameters) {
    var defaults = {
        rowAdded: null,
        rowDeleted: null,
        beforeRowDeleted: null,
        showHideTimeout: 250,
        rowDeleteConfirmMessage: 'Do you want to remove this row?',
        useConfirm: false,
        shouldCleanNewRow: true,
        shouldCloneRow: true
    };

    this.dataRemoveSelector = '[data-remove-location]';
    this.dataAddSelector = '[data-add-location]';
    this.sortableSelctor = '[data-sortable]';
    this.dragIconSelector = '[data-drag-icon]';

    this.settings = $.extend({}, defaults, optionalParameters);

    this.onRowAdded = this.settings.rowAdded;
    this.onRowDeleted = this.settings.rowDeleted;
    this.isSortable = isSortable;
    this.hideLastRow = allowLastRowDelete;
    this.showHideTimeout = this.settings.showHideTimeout;
    this.containerId = containerId;
    this.confirmDivId = this.settings.confirmDivId;
    this.useConfirm = this.settings.useConfirm;
    this.shouldCleanNewRow = this.settings.shouldCleanNewRow;
    this.shouldCloneRow = this.settings.shouldCloneRow;

    this.containerId = containerId;

    // assign the row editor to the data property of the container so that it can be easily retrieved if needed later
    $('#' + containerId).data('dynamic-row-editor', this);

    this.showOrHideDeleteButton.call(this, this.containerId);
    this.toggleSortable.call(this, this.containerId);

    var $container = $('#' + this.containerId);

    $container.off('click', this.dataRemoveSelector).on('click', this.dataRemoveSelector, this.removeRow.bind(this)); //bind DynamicRowEditor as this

    $container.off('click', this.dataAddSelector).on('click', this.dataAddSelector,
        function (e) {
            this.addNewRow();
            e.preventDefault();
        }.bind(this)); //bind DynamicRowEditor as this
}
// end constructor

DynamicRowEditor.prototype.getRows = function () {
    return $('#' + this.containerId + ' [data-row]');
};

DynamicRowEditor.prototype.toggleSortable = function () {

    // _this will be a reference to the DynamicRowEditor instance
    var _this = this;

    var containerId = _this.containerId;
    var $container = $('#' + containerId);

    // only one row, hide sorintg and dragging options
    if (_this.getRows().length === 1 && _this.isSortable) {
        // disable sorting
        $container.find(this.sortableSelctor).sortable({ disabled: true });
        // hide drag icon
        $container.find(this.dragIconSelector).hide();
    } else if (_this.isSortable) {

        var $sortable = $container.find(this.sortableSelctor);
        if (!$sortable.length) {
            throw 'No data-sortable attribute found. Making the rows sortable requires you to apply a data-sortable attribute to the root element for the sortable elements. If this is a table add it to the tbody element.';
        }

        $sortable.sortable({ containment: '#' + containerId, disabled: false });
        $container.find(this.dragIconSelector).show();

    } else {
        $('#' + containerId).find(this.dragIconSelector).hide();
    }
};

DynamicRowEditor.prototype.cleanNewRow = function ($row) {

    // reset text boxes
    // if there is somehting we wish to exclude then an exclusion selector should have a value, we use that here
    if (this.cleanRowExclusionSelector) {
        $row.find(':text:not(' + this.cleanRowExclusionSelector + ')').val('');
    } else {
        $row.find(':text').val('');
    }

    // reset check boxes
    $row.find(":checked").prop("checked", false);

    // reset check lists
    var selectLists = $row.find('select');
    if (selectLists.length) {
        $.each(selectLists, function (index, obj) {
            obj.selectedIndex = 0;
        });
    }
}

DynamicRowEditor.prototype.addNewRow = function () {

    // _this will be a referenc to the DynamicRowEditor instance
    var _this = this;

    var containerId = _this.containerId;

    var $originalRow = $('#' + containerId + ' [data-row]:last');

    if (!this.shouldCloneRow) {

        if (_this.onRowAdded) {
            _this.onRowAdded();
        }
        return;

    }


    // If the last row was hidden simply show the row
    // ******************************************************************************
    if (_this.hideLastRow && _this.getRows().not(':hidden').length === 0) {

        if (_this.onRowAdded) {
            _this.onRowAdded($originalRow);
        }

        if (this.shouldCleanNewRow) {
            this.cleanNewRow($originalRow);
        }

        $originalRow.show();
        return;
    }
    // ******************************************************************************

    var $hidden = $originalRow.find('input[type=hidden]');
    var previousVal = parseInt($hidden.val(), 10);

    // create a duplicate of the row
    var $newRow = $originalRow.clone();

    // show removal button
    $newRow.find(this.dataRemoveSelector).show();

    // increase the value of the hidden input by one. This is the index used by MVC model binding
    $newRow.find('input[type=hidden]').val(previousVal + 1);

    // get all elements that are not of type hidden
    var $allChildren = $newRow.find('* :not([type=hidden])');

    // increase the number in brackets in each found elements name property --> ObjectName[0].SomeProperty --> ObjectName[1].SomeProperty
    $allChildren.each(_this.replaceIdsAndIndexes);

    if (this.shouldCleanNewRow) {
        this.cleanNewRow($newRow);
    }

    //fire custom callback if neccessary
    if (_this.onRowAdded) {
        _this.onRowAdded($newRow);
    }

    // hide so that the row can be faded in 
    $newRow.hide();

    // add new row
    $originalRow.after($newRow);

    // show delete button if applicable
    _this.showOrHideDeleteButton();

    // make sortable if applicable
    _this.toggleSortable();

    // fade in new row
    $newRow.show(_this.showHideTimeout);
};

DynamicRowEditor.prototype.removeRow = function (e) {

    // _this will be a referenc to the DynamicRowEditor instance
    var _this = this;

    e.preventDefault();

    var $rowToRemove = $(e.currentTarget).closest('[data-row]');

    var rowIsNonEmpty = $rowToRemove.find('input[type=text]').is(function (index, obj) {
        return $(obj).val() !== '';
    });

    var remove = function () {
        //fade then remove the row
        $rowToRemove.closest('[data-row]').hide(_this.showHideTimeout, function () {

            var $row = $(this);

            if (_this.getRows().length > 1) {
                // this is the element to remove
                $row.remove();
            }

            _this.showOrHideDeleteButton(_this.containerId);

            // make sortable if applicable
            _this.toggleSortable(_this.containerId);

            if (_this.onRowDeleted) {
                _this.onRowDeleted($row);
            }
        });
    };

    // verify with user that they want to delete the row
    if (rowIsNonEmpty && this.useConfirm && confirm('Do you want to remove this row?')) {

        //remove the row after a confirmation is displayed
        remove();
    } else {

        // just remove the row
        remove();
    }

};

DynamicRowEditor.prototype.showOrHideDeleteButton = function () {

    // _this will be a reference to the DynamicRowEditor instance
    var _this = this;
    var containerId = _this.containerId;

    if (_this.getRows().length === 1 && !_this.hideLastRow) {
        $('#' + containerId + ' ' + _this.dataRemoveSelector).attr('style', 'visibility: hidden');
    } else {
        $('#' + containerId + ' ' + _this.dataRemoveSelector).attr('style', 'visibility: visible');
    }
};

DynamicRowEditor.prototype.replaceIdsAndIndexes = function () {
    // private variables
    var $element = $(this);
    var allBracketedNumbers, allUnderLinedNumbers, foundNumber, numberVal, newVal, newName;

    // regular expressions for finding the number surrounded by brackets and underlines in an elements name and id
    var bracketedValRegEx = new RegExp('\[[0-9]+\]');
    var digitRegEx = new RegExp('\\d+');
    var underLinedValRegEx = new RegExp('[_]*\\d[_]*');


    allBracketedNumbers = bracketedValRegEx.exec($element.attr('name'));
    allUnderLinedNumbers = underLinedValRegEx.exec($element.attr('id'));

    // increment the number used in the name
    // some elements may not have the name property, like the option element of a drop down
    if (allBracketedNumbers && allBracketedNumbers.length > 0) {

        foundNumber = allBracketedNumbers[0];

        // find the int value
        if (foundNumber) {
            numberVal = parseInt(digitRegEx.exec(foundNumber)[0], 10);
        }

        if (numberVal !== undefined && !isNaN(numberVal)) {
            newVal = ++numberVal;
            newName = $element.attr('name').replace(bracketedValRegEx, '[' + newVal + ']');
            $element.attr('name', newName);
        }
    }

    // increment the number used in the id
    if (allUnderLinedNumbers && allUnderLinedNumbers.length > 0) {

        foundNumber = allUnderLinedNumbers[0];

        // find the int value
        if (foundNumber) {
            numberVal = parseInt(digitRegEx.exec(foundNumber)[0], 10);
        }

        if (numberVal !== undefined && !isNaN(numberVal)) {
            newVal = ++numberVal;
            newName = $element.attr('id').replace(underLinedValRegEx, '_' + newVal + '__');
            $element.attr('id', newName);
        }
    }

};
