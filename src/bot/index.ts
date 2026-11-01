// Helpers for people who write a bot on top of the client. How the bot is organised (a switch over commands,
// plugin files, handlers per event, ...) is up to the author; these two only make a received message and a group
// easy to work with.
export { serialize, isMe, type Message, type QuotedMessage } from './message.js'
export { GroupCache, isGroupAdmin, type GroupInfo } from './group.js'
