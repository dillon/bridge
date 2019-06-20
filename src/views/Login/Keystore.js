import { Just, Nothing } from 'folktale/maybe';
import { Ok, Error } from 'folktale/result';
import React from 'react';
import * as keythereum from 'keythereum';
import { Button, UploadButton } from '../../components/old/Base';
import { Input, InnerLabel, InputCaption } from '../../components/old/Base';
import { Row, Col, H1, H3, Warning } from '../../components/old/Base';

import * as need from '../../lib/need';
import { EthereumWallet } from '../../lib/wallet';
import { compose } from '../../lib/lib';
import { withWallet } from '../../store/wallet';

class Keystore extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      keystore: Nothing(), // Maybe<Result<String, String>>
      password: '',
      decryptionProblem: false,
    };

    this.handleKeystoreUpload = this.handleKeystoreUpload.bind(this);
    this.handlePasswordInput = this.handlePasswordInput.bind(this);
    this.constructWallet = this.constructWallet.bind(this);
  }

  handlePasswordInput(password) {
    this.setState({ password });
  }

  constructWallet() {
    const { setWallet } = this.props;
    const { password } = this.state;

    try {
      const text = need.keystore(this.state);

      const json = JSON.parse(text);
      const privateKey = keythereum.recover(password, json);

      const wallet = new EthereumWallet(privateKey);
      this.setState({ decryptionProblem: false });
      setWallet(Just(wallet));
    } catch (err) {
      this.setState({ decryptionProblem: true });
      setWallet(Nothing());
    }
  }

  handleKeystoreUpload = event => {
    const file = event.files.item(0);
    const reader = new FileReader();

    reader.onload = e => {
      const keystore = e.target.result;
      this.setState({ keystore: Just(Ok(keystore)) });
    };

    const failure = _ => {
      const message = 'There was a problem uploading your Keystore file';
      this.setState({ keystore: Just(Error(message)) });
    };

    reader.onerror = failure;
    reader.onabort = failure;

    reader.readAsText(file);
  };

  render() {
    const { wallet } = this.props;
    const { keystore, password, decryptionProblem } = this.state;

    const uploadButtonClass = keystore.matchWith({
      Nothing: _ => 'bg-blue white',
      Just: ks =>
        ks.value.matchWith({
          Ok: _ => 'bg-green white',
          Error: _ => 'bg-yellow black',
        }),
    });

    const decryptMessage =
      decryptionProblem === false ? (
        <div />
      ) : (
        <Warning className={'mt-8'}>
          <H3 style={{ marginTop: 0, paddingTop: 0 }}>
            {"Couldn't decrypt wallet."}
          </H3>
          {'You may have entered an incorrect password.'}
        </Warning>
      );

    return (
      <Row>
        <Col className={'measure-md'}>
          <H1 className={'mb-4'}>{'Upload Your Keystore File'}</H1>
          <InputCaption>
            {`Please upload your Ethereum keystore file.  If your keystore
             file is encrypted with a password, you'll also need to enter
             that below.`}
          </InputCaption>

          <UploadButton
            className={`btn ${uploadButtonClass} mt-10`}
            onChange={this.handleKeystoreUpload}>
            <div className={'flex-center-all fs-4 h-11 pointer'}>
              {'Upload Keystore file'}
            </div>
          </UploadButton>

          <Input
            className="pt-8 mt-8"
            prop-size="md"
            prop-format="innerLabel"
            type="password"
            name="password"
            onChange={this.handlePasswordInput}
            value={password}
            autocomplete="off"
            autoFocus>
            <InnerLabel>{'Password'}</InnerLabel>
          </Input>

          <Button
            className={` mt-10`}
            prop-size={'wide lg'}
            disabled={Nothing.hasInstance(keystore)}
            onClick={this.constructWallet}>
            {'Decrypt'}
          </Button>

          {decryptMessage}

          <Button
            className={'mt-10'}
            prop-size={'wide lg'}
            disabled={Nothing.hasInstance(wallet)}
            onClick={this.props.loginCompleted}>
            {'Continue →'}
          </Button>
        </Col>
      </Row>
    );
  }
}

export default compose(withWallet)(Keystore);
