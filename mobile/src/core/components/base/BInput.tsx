import * as React from 'react';
import { NativeSyntheticEvent, TextInput, TextInputEndEditingEventData, View, Alert } from 'react-native';
import { Colors } from '../../theme/colors';
import { fonts } from '../../theme/fonts';
import { FontSizes, Sizes } from '../../theme/sizes';
// TODO: create BText component
import { Text as BText } from './Text';
import { styles } from 'react-native-markdown-renderer';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onEndEditing?: (value: NativeSyntheticEvent<TextInputEndEditingEventData>) => void;
  keyboard?: KeyboardTypes;
  title?: string;
  placeholder?: string;
  rightIcons?: React.ReactElement;
  editable?: boolean;
}

export enum KeyboardTypes {
  DEFAULT = 'default',
  EMAIL = 'email-address',
  NUMERIC = 'numeric',
  PHONE = 'phone-pad'
}

export class BInput extends React.PureComponent<Props> {

  styles: any = {
    wrapper: {
      borderColor: Colors.BLUE,
      borderWidth: 1,
      padding: Sizes.MEDIUM,
      backgroundColor: Colors.BLACK,
      marginBottom: Sizes.MEDIUM,
      flexDirection: 'row',
      shadowColor: Colors.BLACK,
      shadowOffset: {
        width: 0,
        height: 1
      },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
      elevation: 3
    },
    input: {
      fontFamily: fonts.noto,
      letterSpacing: -1,
      fontSize: FontSizes.MEDIUM,
      fontWeight: '500',
      backgroundColor: Colors.TRANSPARENT,
      height: 25,
      padding: 0,
      width: '100%',
      flex: 1
    },
    end: {
      marginLeft: 'auto'
    }
  };

  getInputStyle = () => {
    return {
      ...this.styles.input,
      color: this.props.editable || this.props.editable === undefined ? Colors.WHITE : Colors.GREY
    }
  }

  render () {
    const {
      editable,
      title,
      value,
      onChange,
      placeholder,
      keyboard,
      onEndEditing,
      rightIcons
    } = this.props;

    return (
      <View>
        {title ? (
          <BText color={Colors.WHITE} size={FontSizes.SMALL}>{title}</BText>
        ) : null}
        <View style={this.styles.wrapper}>
          <TextInput
            editable={editable}
            onEndEditing={onEndEditing}
            value={value}
            onChangeText={onChange}
            style={this.getInputStyle()}
            autoCapitalize={'none'}
            autoCorrect={false}
            keyboardType={keyboard}
            returnKeyType={'done'}
            placeholder={placeholder}
            placeholderTextColor={Colors.GREY_LIGHT}
          />
          <View style={this.styles.end}>
            {rightIcons}
          </View>
        </View>
      </View>
    );
  }
}
