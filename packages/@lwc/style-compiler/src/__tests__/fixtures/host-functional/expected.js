function stylesheet(token, useActualHostSelector, useNativeDirPseudoclass) {
  var shadowSelector = token ? ("[" + token + "]") : "";
  var hostSelector = token ? ("[" + token + "-host]") : "";
  return ((useActualHostSelector ? ":host(.foo) {}" : hostSelector + ".foo {}")) + ((useActualHostSelector ? ":host(.foo) span" + shadowSelector + " {}" : hostSelector + ".foo span" + shadowSelector + " {}")) + ((useActualHostSelector ? ":host(:hover) {}" : hostSelector + ":hover {}")) + ((useActualHostSelector ? ":host(.foo, .bar) {}" : hostSelector + ".foo," + hostSelector + ".bar {}"));
  /*LWC compiler vX.X.X*/
}
export default [stylesheet];