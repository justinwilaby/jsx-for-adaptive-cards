![Adaptive Cards Logo](resources/adaptive-cards-logo.png)

# Adaptive Cards JSX Support for Visual Studio Code 
A [Visual Studio Code](https://code.visualstudio.com/) [extension](https://marketplace.visualstudio.com/VSCode)
for the [Adaptive Cards](http://adaptivecards.io/) [JSX syntax](https://github.com/justinwilaby/babel-plugin-jsx-adaptive-cards)
including features like auto-complete, validation and error checking, intellisense and hover detail. 

### Prerequisites
This plugin is designed to work in conjunction with the [Babel Plugin for JSX Adaptive cards](https://github.com/justinwilaby/babel-plugin-jsx-adaptive-cards)
to transpile this syntax to JavaScript. Detailed instructions on installation and usage are provided there. 

# Features 

## Code completion
The entire Adaptive Card schema has been *adapted* to use JSX syntax for authoring cards. These JSX elements are provided
as code completion snippets

![Adaptive Card Code Completion](resources/auto-complete-acx.gif)

### Attribute code completion 
![Attribute Code Completion](resources/attribute-auto-complete-acx.gif)

## Hover
Get the details of an element by hovering over the tag name, attribute name or attribute values
![Hover detail](resources/hover-acx.gif)

## Schema Validation
Get notifications of errors as they occur so your Adaptive Card is always valid.
![Adaprtive Card Validation](resources/validation-acx.gif)

# Roadmap
- Formatting - Document formatting and cleanup are slated for development now
- Plugin conversion to TypeScript and code coverage
- Auto-complete and auto import of ACX Components
- Better error notifications for invalid markup

# Contributors Needed!
I will be welcoming pull requests for bug fixes, features and unit tests. Feel free to dive in!
