// Constructor
function DynamicRowEditor(containerId, isSortable, allowLastRowDelete, optionalParameters) {

    var defaults = {
        rowAdded: null,
        rowDeleted: null,
        beforeRowDeleted: null,
        showHideTimeout: 250,
        rowDeleteConfirmMessage: 'Do you want to remove this row?',
        confirmDivId: null
    };

    this.settings = $.extend({}, defaults, optionalParameters);

    this.onRowAdded = this.settings.rowAdded;
    this.onRowDeleted = this.settings.rowDeleted;
    this.isSortable = isSortable;
    this.hideLastRow = allowLastRowDelete;
    this.showHideTimeout = this.settings.showHideTimeout;
    this.containerId = containerId;
    this.confirmDivId = this.settings.confirmDivId;

    this.containerId = containerId;

    // assign the row editor to the data property of the container so that it can be easily retrieved if needed later
    $('#' + containerId).data('dynamic-row-editor', this);

    this.showOrHideDeleteButton.call(this, this.containerId);
    this.toggleSortable.call(this, this.containerId);

    var $container = $('#' + this.containerId);

    $container.off('click', 'a[data-remove-location]').on('click', 'a[data-remove-location]', this.removeRow.bind(this)); //bind DynamicRowEditor as this

    $container.off('click', 'button[data-add-location]').on('click', 'button[data-add-location]',
        function (e) {
            this.addNewRow();
            e.preventDefault();
        }.bind(this)); //bind DynamicRowEditor as this

    $container.parents('form').on('submit', null, this, function (e) {
        // this is the form, e.data will be a DynamicRowEditor reference
        if ($(this).valid()) {
            e.data.rows().filter(':hidden').remove();
        }
    });
}
// end constructor

DynamicRowEditor.prototype.rows = function () {
    return $('#' + this.containerId + ' [data-row]');
};

DynamicRowEditor.prototype.toggleSortable = function () {

    // _this will be a reference to the DynamicRowEditor instance
    var _this = this;

    var containerId = _this.containerId;
    var $container = $('#' + containerId);

    if (_this.rows().length === 1 && _this.isSortable) {

        $container.find('[data-sortable]').sortable({ disabled: true });
        $container.find('[data-drag-icon]').hide();
    } else if (_this.isSortable) {

        var $sortable = $container.find('[data-sortable]');
        if (!$sortable.length) {
            throw 'No data-sortable attribute found. Making the rows sortable requires you to apply a data-sortable attribute to the root element for the sortable elements. If this is a table add it to the tbody element.';
        }

        $sortable.sortable({ containment: '#' + containerId, disabled: false });
        $container.find('[data-drag-icon]').show();

    } else {
        $('#' + containerId).find('[data-drag-icon]').hide();
    }
};

DynamicRowEditor.prototype.addNewRow = function () {

    // _this will be a referenc to the DynamicRowEditor instance
    var _this = this;
    var containerId = _this.containerId;

    var $originalRow = $('#' + containerId + ' [data-row]:last');

    // If the last row was hidden simply clean it of error messages and show the row
    // ******************************************************************************
    if (_this.hideLastRow && _this.rows().not(':hidden').length === 0) {
        // remove error classes so that an invalid row does not get shown
        $originalRow.find('.has-error').removeClass('has-error');

        if (_this.onRowAdded) {
            _this.onRowAdded($originalRow);
        }

        // array to hold ids
        var originalIds = [];

        $originalRow.find('[id]').each(function () {
            originalIds.push(this.id);
        });

        $originalRow.find('span').each(function () {
            var $this = $(this);
            if ($.inArray($this.attr('for'), originalIds) > -1) {
                $this.remove();
            }
        });

        $originalRow.show();
        return;
    }
    // ******************************************************************************

    var $hidden = $originalRow.find('input[type=hidden]');
    var previousVal = parseInt($hidden.val(), 10);

    // create a duplicate of the row
    var $newRow = $originalRow.clone();

    // remove error classes so that an invalid row does not affect the one being copied
    $newRow.find('.has-error').removeClass('has-error');

    //remove any validation messages that may have been copied over
    //*************************************************************

    // array to hold ids
    var ids = [];

    $newRow.find('[id]').each(function () {
        ids.push(this.id);
    });

    $newRow.find('span').each(function () {
        var $this = $(this);
        if ($.inArray($this.attr('for'), ids) > -1) {
            $this.remove();
        }
    });
    //*************************************************************

    // show removal button
    $newRow.find('a[data-remove-location]').show();

    // increase the value of the hidden input by one. This is the index used by MVC model binding
    $newRow.find('input[type=hidden]').val(previousVal + 1);

    // get all elements that are not of type hidden
    var $allChildren = $newRow.find('* :not([type=hidden])');

    // increase the number in brackets in each found elements name property --> ObjectName[0].SomeProperty --> ObjectName[1].SomeProperty
    $allChildren.each(_this.replaceIdsAndIndexes);

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

    var remove = function() {
        //fade then remove the row
        $rowToRemove.closest('[data-row]').hide(_this.showHideTimeout, function() {

            var $row = $(this);

            if (_this.rows().length > 1) {
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

    // if the confirmDivId is supplied use the bootstrap modal in place of a confirm window
    if (rowIsNonEmpty && this.confirmDivId) {
        // setup the modal
       ($('#' + this.confirmDivId).confirm(
        {
            callback: remove,
            body: this.settings.rowDeleteConfirmMessage,
            backdrop: 'static' // do not allow the user to click outside of the box to close it. they must make a choice
        })) // immediatley show the modal
           .data('confirm').show();
    } else {
        // not using a confirmation, immediatley remove the row
        remove();
    }

};

DynamicRowEditor.prototype.showOrHideDeleteButton = function () {

    // _this will be a referenc to the DynamicRowEditor instance
    var _this = this;
    var containerId = _this.containerId;

    if (_this.rows().length === 1 && !_this.hideLastRow) {
        $('#' + containerId + ' a[data-remove-location]').attr('style', 'visibility: hidden');
    } else {
        $('#' + containerId + ' a[data-remove-location]').attr('style', 'visibility: visible');
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
