// Tests for Neural Network
import { SimpleNeuralNetwork, createPreTrainedNetwork } from '@/lib/algorithms/neural-network'

describe('SimpleNeuralNetwork', () => {
  test('should create network with correct dimensions', () => {
    const network = new SimpleNeuralNetwork(10, 64, 26)
    expect(network).toBeDefined()
  })

  test('should encode and decode characters', () => {
    const charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const encoded = SimpleNeuralNetwork.encodeChar('A', charSet)
    expect(encoded.length).toBe(charSet.length)
    expect(encoded[0]).toBe(1)
    expect(encoded[1]).toBe(0)
  })

  test('should decode probabilities to character', () => {
    const charSet = 'ABC'
    const probabilities = [0.8, 0.1, 0.1]
    const char = SimpleNeuralNetwork.decodeChar(probabilities, charSet)
    expect(char).toBe('A')
  })

  test('should make predictions', () => {
    const network = new SimpleNeuralNetwork(10, 5, 3)
    const input = Array(10).fill(0).map(() => Math.random())
    const output = network.predict(input)
    
    expect(output.length).toBe(3)
    expect(output.reduce((a, b) => a + b, 0)).toBeCloseTo(1) // Should sum to 1 (softmax)
  })

  test('should train on data', () => {
    const network = new SimpleNeuralNetwork(2, 4, 2)
    const inputs = [[1, 0], [0, 1]]
    const targets = [[1, 0], [0, 1]]
    
    expect(() => {
      network.train(inputs, targets, 0.1)
    }).not.toThrow()
  })

  test('should create pre-trained network', () => {
    const charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '
    const network = createPreTrainedNetwork(charSet)
    expect(network).toBeDefined()
    
    // Test prediction
    const input = SimpleNeuralNetwork.encodeChar('A', charSet)
    const context = Array(9).fill(0).concat(input)
    const output = network.predict(context)
    expect(output.length).toBe(charSet.length)
  })
})

